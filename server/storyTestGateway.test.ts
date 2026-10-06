import {describe,it,expect,vi} from 'vitest';import {once} from 'node:events';
import {createStoryTestGateway} from './storyTestGateway';
import express from 'express';import http from 'node:http';
describe('public test payment allowlist, synthetic upstream',()=>{
  it('cannot start in live/production modes',()=>{
    expect(()=>createStoryTestGateway('http://127.0.0.1:1',{COMMERCE_PAYMENT_MODE:'live'})).toThrow('test_gateway_only');
    expect(()=>createStoryTestGateway('http://127.0.0.1:1',{COMMERCE_PAYMENT_MODE:'test',NODE_ENV:'production'})).toThrow('test_gateway_only');
  });
  it('actual local forwarding preserves the HTTPS Host/Origin pair and stops after upstream switches live',async()=>{
    let mode='test';const upstream=express();upstream.get('/api/stories/status',(_q,r)=>r.json({payment_mode:mode,live_checkout:mode==='live'}));upstream.post('/api/consent',(q,r)=>r.json({host:q.get('host'),origin:q.get('origin')}));
    const back=upstream.listen(0,'127.0.0.1');await once(back,'listening');const gateway=createStoryTestGateway(`http://127.0.0.1:${(back.address() as any).port}`,{COMMERCE_PAYMENT_MODE:'test'}).listen(0,'127.0.0.1');await once(gateway,'listening');const origin=`http://127.0.0.1:${(gateway.address() as any).port}`;
    try{
      const body=await new Promise<string>((resolve,reject)=>{const request=http.request(origin+'/api/consent',{method:'POST',headers:{Host:'public.example.test',Origin:'https://public.example.test'}},r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>resolve(s));});request.on('error',reject);request.end();});
      expect(JSON.parse(body)).toEqual({host:'public.example.test',origin:'https://public.example.test'});
      mode='live';expect((await fetch(origin+'/')).status).toBe(503);
    }finally{gateway.close();gateway.closeAllConnections();back.close();back.closeAllConnections();}
  });
  it('denies AI and owner settings, preserves redirect cookies and webhook bodies',async()=>{
    const transport=vi.fn(async(url:any,_init?:RequestInit)=>String(url).endsWith('/api/stories/status')?Response.json({payment_mode:'test',live_checkout:false}):new Response('synthetic',{status:200,headers:{'Set-Cookie':'zerkalo_stories=synthetic; HttpOnly; Secure; SameSite=Lax'}}));
    const app=createStoryTestGateway('http://127.0.0.1:39791',{COMMERCE_PAYMENT_MODE:'test'},transport as any),server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;
    try{
      for(const url of ['/local-story-setup','/api/local-story-setup','/local-story-support','/.env','/api/personal-myth','/api/stories/order-1/myth','/api/stories/order-1/albert'])expect((await fetch(origin+url,{method:'POST'})).status).toBe(404);
      expect(transport).not.toHaveBeenCalled();
      const r=await fetch(origin+'/?stories=1');expect(r.headers.getSetCookie()).toEqual(['zerkalo_stories=synthetic; HttpOnly; Secure; SameSite=Lax']);
      const body='{"event":"payment.succeeded","object":{"id":"synthetic"}}';
      await fetch(origin+'/api/stories/payment-webhook',{method:'POST',body,headers:{'Content-Type':'application/json'}});const call=transport.mock.calls.find(c=>String(c[0]).endsWith('/api/stories/payment-webhook'))!;expect(Buffer.from(call[1]?.body as any).toString()).toBe(body);
      expect(String(call[0])).toBe('http://127.0.0.1:39791/api/stories/payment-webhook');
    }finally{server.close();server.closeAllConnections();}
  });
});
