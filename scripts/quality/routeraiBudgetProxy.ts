/** Acceptance-only transport: one serial gateway, durable reserve BEFORE spend.
 * Not imported by the product. No keys/prompts/raw provider responses in ledger. */
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {PRIMARY_MODEL,FALLBACK_MODEL,ROUTERAI_URL} from '../../server/routerai';
import {SpendGuard,type Rates} from './spendGuard';

export async function startBudgetProxy(key:string, ledgerFile:string) {
  if(!key.trim()) throw new Error('routerai_not_ready');
  const lockFile='/private/tmp/zerkalo-routerai-final-acceptance.lock';
  let lock:number;
  try {lock=fs.openSync(lockFile,'wx',0o600);} catch {throw new Error('acceptance_already_locked');}
  fs.writeSync(lock,String(process.pid));
  const release=()=>{fs.closeSync(lock);fs.unlinkSync(lockFile);};
  try {
    const proxy=await startLockedBudgetProxy(key,ledgerFile);
    return {...proxy,close:async()=>{try{await proxy.close();}finally{release();}}};
  } catch(error) {release();throw error;}
}

async function startLockedBudgetProxy(key:string, ledgerFile:string) {
  const auth={Authorization:`Bearer ${key}`};
  const get=async(path:string)=>{
    const r=await fetch(`${ROUTERAI_URL}${path}`,{headers:auth,signal:AbortSignal.timeout(15_000)});
    if(!r.ok) throw new Error(`routerai_preflight_http_${r.status}`);
    return await r.json() as any;
  };
  const credits=async()=>{
    const j=await get('/credits');
    if(typeof j?.data?.credits !== 'number')throw new Error('routerai_credits_contract');
    return j.data.credits as number;
  };
  const rates:Record<string,Rates>={};
  for(const model of [PRIMARY_MODEL,FALLBACK_MODEL]) {
    const data=await get(`/models/${model}/endpoints`);
    const endpoints=(data?.data?.endpoints||[]).filter((e:any)=>model!==FALLBACK_MODEL || e.tag==='deepseek');
    if(!endpoints.length)throw new Error('routerai_endpoint_missing');
    const pricing=endpoints.flatMap((e:any)=>[e.pricing,...(e.variable_pricings||[])]);
    const input=Math.max(...pricing.map((p:any)=>Number(p.prompt)));
    const output=Math.max(...pricing.map((p:any)=>Number(p.completion)));
    if(!Number.isFinite(input)||input<=0||!Number.isFinite(output)||output<=0)throw new Error('routerai_tariff_unknown');
    rates[model]={input,output};
  }
  const previous=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile,'utf8')):null;
  const guard=new SpendGuard(previous?.state);
  const baseline=previous?.baselineCredits ?? await credits();
  const events:any[]=previous?.events || [];
  const save=()=>{
    const temp=ledgerFile+'.tmp';
    fs.writeFileSync(temp,JSON.stringify({state:guard.state,baselineCredits:baseline,rates,events},null,2),{mode:0o600});
    fs.renameSync(temp,ledgerFile);
  };
  // An interrupted in-flight call is uncertain: retain its reserve and stop, not reset.
  if(guard.reservedRub>0)guard.state.blocked=true;
  guard.reconcileBalance(Math.max(0,baseline-await credits()));save();
  if(guard.state.blocked)throw new Error('spend_guard_blocked');
  const nonce=crypto.randomBytes(24).toString('hex');
  // A caller can time out before RouterAI reports its final cost. Serialize the
  // next attempt behind settlement, not a synthetic 409 masquerading as provider
  // failure. Disconnected queued callers never create a new billable request.
  let settled:Promise<void>=Promise.resolve();
  const server=http.createServer(async(req,res)=>{
    const reply=(status:number,body:unknown)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    if(req.method!=='POST'||req.url!=='/completion'||req.headers['x-acceptance-token']!==nonce)return reply(403,{error:'acceptance_forbidden'});
    let disconnected=false;
    req.once('aborted',()=>{disconnected=true;});
    res.once('close',()=>{disconnected=true;});
    const previous=settled;
    let release!:()=>void;
    settled=new Promise<void>(resolve=>{release=resolve;});
    await previous;
    let id:string|undefined;
    try {
      if(disconnected||res.destroyed)return;
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>1_000_000)throw new Error('acceptance_body_limit');chunks.push(chunk);}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!rates[body.model])throw new Error('acceptance_model_not_allowed');
      if(body.include_reasoning!==false || body.provider?.allow_fallbacks!==false
         || (body.model===PRIMARY_MODEL && body.reasoning?.effort!=='low'))throw new Error('acceptance_primary_contract');
      if(body.model===FALLBACK_MODEL && (JSON.stringify(body.provider?.only)!=='["deepseek"]'||body.provider?.allow_fallbacks!==false
        ||body.thinking?.type!=='disabled'||body.include_reasoning!==false))throw new Error('acceptance_fallback_contract');
      guard.reconcileBalance(Math.max(0,baseline-await credits()));
      if(disconnected||res.destroyed)return;
      const next=crypto.randomUUID();guard.reserve(next,body,body.max_tokens,rates[body.model]);id=next;save();
      const started=Date.now();
      const response=await fetch(`${ROUTERAI_URL}/chat/completions`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},
        body:JSON.stringify(body),signal:AbortSignal.timeout(100_000)});
      const payload=await response.json();
      const cost=typeof payload?.usage?.cost==='number'?payload.usage.cost:response.ok?null:0;
      guard.settle(id,cost);
      events.push({model:body.model,status:response.status,costRub:cost,latencyMs:Date.now()-started});save();
      // Forward only successful content or a bounded status identifier, never provider error bodies.
      reply(response.status,response.ok?payload:{error:`provider_http_${response.status}`});
    } catch(error) {
      if(id && guard.state.pending[id]!==undefined)guard.settle(id,null);
      const message=error instanceof Error?error.message:'';
      const code=/^(spend_|acceptance_|routerai_)[a-z0-9_]+$/.test(message)?message:'acceptance_transport_unknown';
      guard.state.blocked=true;events.push({error:code});save();reply(402,{error:code});
    } finally {release();}
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();if(!address||typeof address==='string')throw new Error('acceptance_proxy_address');
  const url=`http://127.0.0.1:${address.port}/completion`;
  const transport:typeof fetch=async(_url,options)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Acceptance-Token':nonce},body:options?.body,signal:options?.signal});
  return {url,nonce,transport,guard,events,
    close:async()=>{await new Promise<void>(r=>server.close(()=>r()));await settled;save();},
  };
}
