import http from 'node:http';
import {FirstSalesAttemptGuard} from './firstSalesAttemptGuard';
/** Loopback-only experiment gateway. Product requests are forwarded unchanged. */
export async function startFirstSalesProxy(file:string,apiKey:string,transport:typeof fetch=fetch){
  if(!apiKey)throw new Error('owner_routerai_key_required');
  const guard=new FirstSalesAttemptGuard(file);
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/api/v1/chat/completions'||req.headers.authorization!==`Bearer ${apiKey}`){res.writeHead(403);res.end();return;}
    let body='';
    try{
      for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>300000)throw new Error('body_limit');}
      const request=JSON.parse(body);
      if(!['deepseek/deepseek-v4.1-flash','anthropic/claude-sonnet-5'].includes(request.model))throw new Error('model_outside_accepted_generators');
      if(!Number.isInteger(request.max_tokens)||request.max_tokens<1||request.max_tokens>8000)throw new Error('output_budget_outside_accepted_generators');
      const response=await guard.call(body,()=>transport('https://routerai.ru/api/v1/chat/completions',{
        method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(70000),
      }));
      res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await response.text());
    }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":{"message":"bounded_attempt_guard_STOP"}}');}
  });
  try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}catch(e){guard.close();throw e;}
  const origin=`http://127.0.0.1:${(server.address() as any).port}`;
  return {origin,guard,close:()=>new Promise<void>(resolve=>server.close(()=>{guard.close();resolve();}))};
}
