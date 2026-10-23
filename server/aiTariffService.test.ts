// @vitest-environment node
import {it,expect,vi} from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import seed from './aiTariffs.json';
import {CommerceStore} from './commerceStore';import {AIBudget,PAID_COST_RESERVE,MAX_ATTEMPT_MICRO,withAIBudget} from './aiBudget';
import {STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH} from './storySample';
import {initialiseTariffs,currentTariffs,estimateAttempt,maxAttempt,refreshTariffs,acceptTariffs,budgetPolicy,validateTariffs} from './aiTariffService.mjs';
const key='e'.repeat(64),base=Date.parse(seed.captured_at);
const env={COMMERCE_BUDGET_APPROVED:'true',COMMERCE_DATA_KEY:key,COMMERCE_FREE_BUDGET_RUB:'1000',COMMERCE_FREE_ATTEMPT_MAX:'12',COMMERCE_PAID_BUDGET_RUB:String(Math.ceil(PAID_COST_RESERVE/1e6)),COMMERCE_PAID_ATTEMPT_MAX:'52',COMMERCE_PAID_ORDER_MAX:'1'};
function paid(db:CommerceStore,b:AIBudget){const a=db.createAccount(true);db.importFree(a.id,STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH);const o=db.createOrder(a.id,'versioned_paid','paid',true);b.hold(a.id,o.id);db.attachPayment(a.id,o.id,'p_'+o.id,'https://yoomoney.ru/test');db.confirmPayment(a.id,o.id,{id:'p_'+o.id,status:'succeeded',paid:true,test:true,amount:{value:'790.00',currency:'RUB'},metadata:{order_id:o.id}});return {a,o};}
const transport=(multiplier=1,requests:string[]=[])=>(async(url:any,options:any)=>{requests.push(String(url));expect(options?.headers).toBeUndefined();const row=seed.rows.find(r=>String(url)===r.source)!;const endpoints=structuredClone(row.endpoints);
 for(const e of endpoints){for(const k of Object.keys(e.pricing))e.pricing[k]*=multiplier;for(const v of e.variable_pricings)for(const k of ['prompt','completion','input_cache_read','input_cache_write'])if(v[k]!==undefined)v[k]*=multiplier;}
 return new Response(JSON.stringify({data:{id:row.model,endpoints}}));}) as typeof fetch;
it('DCS health must prove this budget policy and database, an old wrapper cannot open the bridge',async()=>{
 const db=new CommerceStore(':memory:',key),b=new AIBudget(()=>db,env,transport(),()=>base);b.db();const binding=crypto.createHmac('sha256',key).update('budget-db:'+db.filename).digest('hex');
 const spy=vi.spyOn(globalThis,'fetch');try{
   spy.mockResolvedValue(new Response('{}',{headers:{'x-ai-budget-schema':'1','x-ai-budget-fingerprint':binding}}));await expect(b.dcsHeaders('http://127.0.0.1:9')).rejects.toThrow('dcs_budget_not_covered');
   spy.mockResolvedValue(new Response('{}',{headers:{'x-ai-budget-schema':'1','x-ai-budget-policy':budgetPolicy.version,'x-ai-budget-fingerprint':binding}}));expect((await b.dcsHeaders('http://127.0.0.1:9'))['X-AI-Budget-Scope']).toContain('.');
 }finally{spy.mockRestore();db.close();}
});
it('request components and response schema obey exact UTF-8 boundary; output limits include generation, no mean word length',()=>{
 const s={...seed,version:'fixture'};const content='x'.repeat(65536-Buffer.byteLength(JSON.stringify({messages:[{role:'user',content:''}]})));
 expect(estimateAttempt(s,seed.rows[0].model,[{role:'user',content}],8000,base).input_bytes).toBe(65536);
 expect(()=>estimateAttempt(s,seed.rows[0].model,[{role:'user',content:content+'x'}],8000,base)).toThrow('ai_input_bound_exceeded');
 expect(()=>estimateAttempt(s,seed.rows[0].model,[{role:'user',content}],8000,base,{type:'json_object'})).toThrow('ai_input_bound_exceeded');
 expect(()=>estimateAttempt(s,seed.rows[0].model,[{role:'user',content:'ok'}],12001,base)).toThrow();
 expect(()=>estimateAttempt(s,seed.rows[0].model,[{role:'user',content:'\ud800'}],100,base)).toThrow();
 expect(estimateAttempt(s,seed.rows[1].model,[{role:'user',content:'ok'}],100,base).cost_micro).toBeGreaterThan(estimateAttempt(s,seed.rows[0].model,[{role:'user',content:'ok'}],100,base).cost_micro);
 expect(budgetPolicy.strict_invoice_ceiling_verified).toBe(false);expect(MAX_ATTEMPT_MICRO).toBeLessThan(75e6);
});
it('Python and Web use identical formula and boundary for ASCII, Russian, emoji, controls and response schema',()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'tariff-parity-')),'data.sqlite'),db=new CommerceStore(file,key);initialiseTariffs(db.db,seed);const s=currentTariffs(db.db);
 const boundary='a'.repeat(65536-Buffer.byteLength(JSON.stringify({messages:[{role:'user',content:''}]})));
 const cases=[{messages:[{role:'user',content:'русский 🪞\n\t\" / \u2028'}],response_format:{type:'json_object'},max_tokens:2500},{messages:[{role:'user',content:boundary}],max_tokens:8000},{messages:[{role:'system',content:'x'},{role:'user',content:boundary}],max_tokens:8000},{messages:[{role:'user',content:'x'}],max_tokens:8001}];
 const dcs=process.env.DCS_ROOT!,python=process.env.PYTHON_BIN!;
 const script=`import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('b',${JSON.stringify(path.resolve('scripts/quality/dcs_budget_bootstrap.py'))});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nv=json.load(sys.stdin);out=[]\nfor b in v['cases']:\n try:\n  cost,size,maximum=m.estimate(v['snapshot'],b,v['now']);out.append({'cost':cost,'bytes':size,'maximum':maximum})\n except RuntimeError as e:out.append({'error':str(e)})\nprint(json.dumps(out))`;
 const bodies=cases.map(c=>({...c,model:seed.rows[0].model}));const result=spawnSync(python,['-c',script],{cwd:dcs,encoding:'utf8',input:JSON.stringify({snapshot:s,cases:bodies,now:base}),env:{...process.env,COMMERCE_DB_PATH:file,FIRST_SALES_PROXY_URL:''}});expect(result.status,result.stderr).toBe(0);
 const expected=bodies.map(c=>{try{const e=estimateAttempt(s,c.model,c.messages,c.max_tokens,base,c.response_format);return {cost:e.cost_micro,bytes:e.input_bytes,maximum:maxAttempt(s)};}catch(e){return {error:e.message};}});expect(JSON.parse(result.stdout.trim())).toEqual(expected);db.close();
});
it('automatic public refresh persists a version and restart keeps it; old in-flight capture cannot replace newer snapshot',async()=>{
 const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'tariff-restart-')),'data.sqlite');let db=new CommerceStore(filename,key),clock=base;const requests:string[]=[];const b=new AIBudget(()=>db,env,transport(1,requests),()=>clock);b.db();const {o}=paid(db,b);const previous=currentTariffs(db.db);clock=base+13*3600000;const updated=await b.prepare();expect(requests).toHaveLength(4);expect(updated.version).not.toBe(previous.version);expect(updated.captured_at).toBe(new Date(clock).toISOString());
 acceptTariffs(db.db,previous,clock);expect(currentTariffs(db.db).version).toBe(updated.version);db.close();db=new CommerceStore(filename,key);const reopened=new AIBudget(()=>db,env,transport(1,requests),()=>clock);expect((await reopened.prepare()).version).toBe(updated.version);expect(requests).toHaveLength(4);
 clock=base+25*3600000;const renewed=await reopened.prepare();expect(requests).toHaveLength(8);expect(renewed.version).not.toBe(updated.version);withAIBudget({pool:'paid',orderId:o.id},()=>reopened.reserve(seed.rows[0].model,{messages:[{role:'user',content:'synthetic'}],max_tokens:100}));expect((db.db.prepare('SELECT estimate_version FROM ai_budget_attempts').get() as any).estimate_version).toBe(renewed.version);db.close();
});
it('failed refresh continues paid service only within last accepted TTL, then preserves rights, records incident and stops sales',async()=>{
 const db=new CommerceStore(':memory:',key);let clock=base;const b=new AIBudget(()=>db,env,(async()=>{throw Error('synthetic outage');}) as typeof fetch,()=>clock);b.db();const {a,o}=paid(db,b);const original=currentTariffs(db.db).version;
 clock=base+13*3600000;await b.prepare();withAIBudget({pool:'paid',orderId:o.id},()=>b.reserve(seed.rows[0].model,{messages:[{role:'user',content:'synthetic'}],max_tokens:100}));expect(currentTariffs(db.db).version).toBe(original);
 clock=base+25*3600000;await expect(b.prepare()).rejects.toThrow('ai_tariffs_stale');expect(b.capacity()).toBe(false);expect(db.order(a.id,o.id).state).toBe('paid');expect(db.budgetSummary().incidents.some((r:any)=>r.order_id===o.id&&r.reason==='ai_tariffs_stale')).toBe(true);expect(db.budgetSummary().commitments[0]['capacity_micro']).toBe(PAID_COST_RESERVE);db.close();
});
it('price growth cannot increase approved pools or silently spend an old paid liability; reserved version is retained',async()=>{
 const db=new CommerceStore(':memory:',key);let clock=base;const b=new AIBudget(()=>db,env,transport(2),()=>clock);b.db();const {a,o}=paid(db,b);const original=currentTariffs(db.db).version;
 clock=base+13*3600000;await b.prepare();expect(()=>withAIBudget({pool:'paid',orderId:o.id},()=>b.reserve(seed.rows[1].model,{messages:[{role:'user',content:'synthetic'}],max_tokens:100}))).toThrow('paid_service_waiting');expect(b.capacity()).toBe(false);
 const held=db.budgetSummary().commitments[0] as any;expect(held.capacity_micro).toBe(PAID_COST_RESERVE);expect(held.estimate_version).toBe(original);expect(held.spent_micro).toBe(0);expect(db.order(a.id,o.id).state).toBe('paid');expect(db.budgetSummary().incidents.some((r:any)=>r.reason==='paid_service_waiting')).toBe(true);db.close();
});
it('bad currency, model, unit, unknown charged feature and incomplete capture never replace last accepted prices',async()=>{
 const db=new CommerceStore(':memory:',key);initialiseTariffs(db.db,seed);const version=currentTariffs(db.db).version;
 expect(()=>validateTariffs({...seed,currency:'USD'},base)).toThrow();const changed=structuredClone(seed);changed.rows[0].endpoints[0].pricing_units.prompt='request';expect(()=>validateTariffs(changed,base)).toThrow();
 const unknown:any=structuredClone(seed);unknown.rows[0].endpoints[0].pricing.reasoning=1;unknown.rows[0].endpoints[0].pricing_units.reasoning='token';expect(()=>validateTariffs(unknown,base)).toThrow();
 await expect(refreshTariffs(db.db,(async()=>new Response(JSON.stringify({data:{id:'different',endpoints:[]}}))) as typeof fetch,base)).rejects.toThrow('ai_tariff_model_changed');expect(currentTariffs(db.db).version).toBe(version);db.close();
});

const OPUS='anthropic/claude-opus-5.5';
const catalog=(opus:'ok'|'http500'|'network'|'bad_schema'|'wrong_id',multiplier=1)=>(async(url:any)=>{
  const row=seed.rows.find(r=>String(url)===r.source)!;
  if(row.model===OPUS){
    if(opus==='http500')return new Response('{}',{status:500});
    if(opus==='network')throw new TypeError('fetch failed');
    if(opus==='bad_schema')return new Response(JSON.stringify({data:{id:OPUS,endpoints:[{pricing:{prompt:'x'}}]}}));
    if(opus==='wrong_id')return new Response(JSON.stringify({data:{id:'other',endpoints:row.endpoints}}));
  }
  const endpoints=structuredClone(row.endpoints);for(const e of endpoints)for(const k of Object.keys(e.pricing))(e.pricing as any)[k]*=multiplier;
  return new Response(JSON.stringify({data:{id:row.model,endpoints}}));
}) as typeof fetch;
it('an unavailable or malformed Opus row is not fatal: other models refresh, Opus keeps the static row, a warning is logged',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try{
    for(const mode of ['http500','network','bad_schema','wrong_id'] as const){
      const db=new CommerceStore(':memory:',key);
      try{
        initialiseTariffs(db.db,seed);
        const snapshot=await refreshTariffs(db.db,catalog(mode,2),base+3600000);
        expect(snapshot.rows.map((r:any)=>r.model)).toEqual(seed.rows.map(r=>r.model));
        const opus=snapshot.rows.find((r:any)=>r.model===OPUS),flash=snapshot.rows[0];
        expect(opus).toEqual(seed.rows.find(r=>r.model===OPUS));
        expect(flash.input_rate).toBeCloseTo(seed.rows[0].input_rate*2,12);
      }finally{db.close();}
    }
    expect(warn.mock.calls.filter(c=>c[0]==='ai_tariff_optional_model_kept_static')).toHaveLength(4);
  }finally{warn.mockRestore();}
});
it('a failing non-optional model still fails the whole refresh',async()=>{
  const db=new CommerceStore(':memory:',key);initialiseTariffs(db.db,seed);
  const broken=(async(url:any)=>String(url).includes('claude-sonnet-5')?new Response('{}',{status:503}):catalog('ok')(url)) as typeof fetch;
  try{await expect(refreshTariffs(db.db,broken,base+3600000)).rejects.toThrow('ai_tariff_source_unavailable');}finally{db.close();}
});
it('the attempt ceiling counts Opus (12000 output tokens) for the default v2a writer and the v4.1 rollback, not for legacy',()=>{
  const byDefault=maxAttempt(seed);
  vi.stubEnv('PERSONAL_MYTH_WRITER','legacy');const legacy=maxAttempt(seed);
  vi.stubEnv('PERSONAL_MYTH_WRITER','v41');const v41=maxAttempt(seed);vi.unstubAllEnvs();
  expect(byDefault).toBe(MAX_ATTEMPT_MICRO);expect(legacy).toBeLessThan(40e6);
  expect(byDefault).toBeGreaterThan(legacy);expect(v41).toBe(byDefault);
  expect(byDefault).toBe(Math.ceil((65536*0.00044150496+12000*0.0022075248)*1.25*1e6));
});
