import express from 'express';
import http from 'node:http';
// Node fetch does not preserve a caller-supplied Host header. The upstream must see the HTTPS host for same-origin validation.
const forwardLocal=(async(input:any,init:RequestInit={})=>new Promise<Response>((resolve,reject)=>{
  const url=new URL(String(input));if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')return reject(new Error('loopback_only'));
  const request=http.request(url,{method:init.method||'GET',headers:init.headers as any,signal:init.signal||undefined},response=>{
    const chunks:Buffer[]=[];response.on('data',c=>chunks.push(c));response.on('error',reject);response.on('end',()=>{
      const headers=new Headers();for(const [name,value]of Object.entries(response.headers))if(value!==undefined)for(const item of Array.isArray(value)?value:[value])headers.append(name,item);
      resolve(new Response(Buffer.concat(chunks),{status:response.statusCode||502,headers}));
    });
  });request.on('error',reject);if(init.body)request.write(init.body);request.end();
})) as typeof fetch;
/** HTTPS tunnel terminates at this test-only allowlist, never at the owner setup server. */
export function createStoryTestGateway(upstream:string,env:NodeJS.ProcessEnv,transport:typeof fetch=forwardLocal){
  const base=new URL(upstream);
  if(env.COMMERCE_PAYMENT_MODE!=='test'||env.NODE_ENV==='production'||base.protocol!=='http:'||base.hostname!=='127.0.0.1')throw new Error('test_gateway_only');
  const app=express();
  app.use(async(req,res)=>{
    const pathname=new URL(req.url,'http://gateway.local').pathname;
    const read=req.method==='GET'&&(pathname==='/'||/^\/assets\/[^.][\w./-]+$/.test(pathname)||['/api/consent','/api/stories/status','/api/stories','/api/stories-sample','/api/stories-sample/pdf'].includes(pathname)||/^\/api\/stories\/[\w-]+$/.test(pathname));
    const write=req.method==='POST'&&(['/api/consent','/api/stories/account','/api/stories/restore','/api/stories/recovery','/api/stories/import-free','/api/stories/offer','/api/stories/orders','/api/stories/delete','/api/stories/payment-webhook'].includes(pathname)||/^\/api\/stories\/[\w-]+\/(checkout|payment-refresh|support|note|pdf)$/.test(pathname));
    if(!read&&!write)return res.sendStatus(404); // all AI, owner setup/operator, env/files, arbitrary endpoints denied
    try{
      const status=await transport(new URL('/api/stories/status',base),{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
      if(status.payment_mode!=='test'||status.live_checkout!==false)return res.status(503).json({code:'test_mode_required'});
      const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>500000)throw new Error('body_limit');chunks.push(chunk);}
      const headers:Record<string,string>={};for(const name of ['host','origin','cookie','content-type','accept'])if(typeof req.headers[name]==='string')headers[name]=req.headers[name] as string;
      const response=await transport(new URL(req.url,base),{method:req.method,headers,...(write?{body:Buffer.concat(chunks)}:{}),redirect:'manual',signal:AbortSignal.timeout(45000)});
      res.status(response.status);for(const [name,value]of response.headers)if(!['set-cookie','transfer-encoding','connection','content-encoding','content-length'].includes(name))res.setHeader(name,value);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
      res.send(Buffer.from(await response.arrayBuffer()));
    }catch{res.status(502).json({code:'test_gateway_unavailable'});}
  });
  return app;
}
