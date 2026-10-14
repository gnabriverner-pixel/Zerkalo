import {describe,it,expect,vi} from 'vitest';
import express from 'express';
import {once} from 'node:events';
import {CommerceStore} from './commerceStore';
import {installConsentRoutes} from './consent';
import {installStoryCommerce} from './storyCommerce';
import {MockStoryPayment,YooTestPayment,type StoryPayment} from './storyPayment';
import {STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH} from './storySample';
import {CONSENT_VERSION} from '../src/services/consent';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
async function setup(payment:StoryPayment=new MockStoryPayment()){
  const store=new CommerceStore(':memory:','c'.repeat(64)),app=express();app.use(express.json());installConsentRoutes(app);
  const myth=vi.fn(async()=>({status:'ok',story_result:STORY_SAMPLE_MYTH}));
  const albert=vi.fn(async()=>({status:'ok',response:'Синтетический обычный ответ Альберта.'}));
  installStoryCommerce(app,{store,payment,myth,albert,ready:()=>true});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;let cookies='';
  const call=async(url:string,body?:any)=>{
    const response=await fetch(origin+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookies,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    for(const value of response.headers.getSetCookie()){
      const pair=value.split(';')[0],name=pair.split('=')[0];cookies=cookies.split('; ').filter(v=>!v.startsWith(name+'=')).concat(pair).join('; ');
    }
    const data=await response.json();return {response,data};
  };
  const consent=()=>call('/api/consent',{accepted:true,adult:true,version:CONSENT_VERSION,scope:'core'});
  const close=()=>{server.close();server.closeAllConnections();store.close();};
  return {store,myth,albert,call,consent,close,origin};
}
describe('commerce HTTP contracts, synthetic transport only',()=>{
  it('operator view reads queued order status, excludes personal text and remains loopback-only',async()=>{
    const before=process.env.LOCAL_STORY_SETUP;process.env.LOCAL_STORY_SETUP='true';const s=await setup();
    try{
      await s.consent();await s.call('/api/personal-myth',{request_id:'support_free_001',answers:STORY_SAMPLE_ANSWERS});
      expect((await s.call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'})).response.status).toBe(200);
      const order=(await s.call('/api/stories/orders',{request_key:'support_order_001'})).data.order;
      await s.call(`/api/stories/${order.id}/support`,{reason:'delivery'});
      const r=await s.call('/api/local-story-support');expect(r.response.status).toBe(200);expect(r.data.requests).toEqual([expect.objectContaining({order_id:order.id,reason:'delivery',test:1,state:'pending_payment'})]);
      expect(JSON.stringify(r.data)).not.toContain(STORY_SAMPLE_ANSWERS.q1);expect(JSON.stringify(r.data)).not.toContain('recovery');
      const status=await new Promise(resolve=>{http.get(s.origin+'/api/local-story-support',{headers:{Host:'public.example.test'}},r=>{r.resume();resolve(r.statusCode);});});expect(status).toBe(404);
    }finally{s.close();if(before===undefined)delete process.env.LOCAL_STORY_SETUP;else process.env.LOCAL_STORY_SETUP=before;}
  });
  it('general deletion reopens the archive after restart even when its library has not been opened',async()=>{
    const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'general-delete-')),'stories.sqlite'),key='d'.repeat(64);
    const previous=new CommerceStore(filename,key),owner=previous.createAccount(true);
    previous.importFree(owner.id,STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH);previous.close();
    const env={COMMERCE_ENABLED:process.env.COMMERCE_ENABLED,COMMERCE_DB_PATH:process.env.COMMERCE_DB_PATH,COMMERCE_DATA_KEY:process.env.COMMERCE_DATA_KEY};
    Object.assign(process.env,{COMMERCE_ENABLED:'true',COMMERCE_DB_PATH:filename,COMMERCE_DATA_KEY:key});
    const app=express(),commerce=installStoryCommerce(app,{ready:()=>false,myth:vi.fn(),albert:vi.fn()});
    app.post('/api/general-delete-probe',(req,res)=>res.json({deleted:commerce.deleteOwned(req,res)}));
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;
    try{
      const r=await fetch(origin+'/api/general-delete-probe',{method:'POST',headers:{Origin:origin,Cookie:`zerkalo_stories=${owner.access}`}});
      expect(await r.json()).toEqual({deleted:true});expect(commerce.store().db.prepare('SELECT payload FROM orders').get()).toMatchObject({payload:null});
      expect(()=>commerce.store().restore(owner.recovery)).toThrow('recovery_invalid');
    }finally{server.close();server.closeAllConnections();commerce.store().close();for(const [k,v] of Object.entries(env))if(v===undefined)delete process.env[k];else process.env[k]=v;}
  });
  it('uses the retrieved merchant object for delayed and duplicate webhooks, then records refund after deletion',async()=>{
    let object:any;
    const payment:StoryPayment={mode:'test',create:vi.fn(async order=>object={id:'synthetic-payment',status:'pending',paid:false,test:true,amount:{value:'790.00',currency:'RUB'},metadata:{order_id:order.id},confirmation:{confirmation_url:'https://yoomoney.ru/synthetic'}}),get:vi.fn(async()=>structuredClone(object)),refund:vi.fn(async()=>({id:'refund-1',payment_id:'synthetic-payment',status:'succeeded',amount:{value:'790.00',currency:'RUB'}}))};
    const s=await setup(payment);try{
      await s.consent();await s.call('/api/personal-myth',{request_id:'webhook_free_0001',answers:STORY_SAMPLE_ANSWERS});
      await s.call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});
      const order=(await s.call('/api/stories/orders',{request_key:'webhook_order_0001'})).data.order;
      await s.call(`/api/stories/${order.id}/checkout`,{});
      const notification={event:'payment.succeeded',object:{id:'synthetic-payment',status:'succeeded',paid:true}};
      expect((await s.call('/api/stories/payment-webhook',notification)).response.status).toBe(200);
      expect((await s.call(`/api/stories/${order.id}`)).data.order.state).toBe('pending_payment');
      object.status='succeeded';object.paid=true;
      await s.call('/api/stories/payment-webhook',notification);await s.call('/api/stories/payment-webhook',notification);
      expect((await s.call(`/api/stories/${order.id}`)).data.order.state).toBe('paid');
      expect(s.store.db.prepare("SELECT COUNT(*) AS n FROM events WHERE name='server_confirmed' AND order_id=?").get(order.id)).toMatchObject({n:1});
      expect(payment.get).toHaveBeenCalledTimes(3);
      await s.call('/api/stories/delete',{confirmed:true});
      expect((await s.call('/api/stories/payment-webhook',{event:'refund.succeeded',object:{id:'refund-1'}})).response.status).toBe(200);
      expect(s.store.db.prepare('SELECT state,payload FROM orders WHERE id=?').get(order.id)).toMatchObject({state:'refunded',payload:null});
    }finally{s.close();}
  });
  it('refusal has no account or protected generator call; real consent enables exactly one free Myth',async()=>{
    const s=await setup();try{
      expect((await s.call('/api/personal-myth',{request_id:'free_myth_00001',answers:STORY_SAMPLE_ANSWERS})).response.status).toBe(403);
      expect(s.myth).not.toHaveBeenCalled();expect(s.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()).toMatchObject({n:0});
      await s.consent();const request={request_id:'free_myth_00001',answers:STORY_SAMPLE_ANSWERS};
      expect((await s.call('/api/personal-myth',request)).response.status).toBe(202);
      await vi.waitFor(()=>expect(s.myth).toHaveBeenCalledTimes(1));
      expect((await s.call('/api/personal-myth',request)).response.status).toBe(200);
      expect(s.myth).toHaveBeenCalledTimes(1);
      expect((await s.call('/api/personal-myth',{...request,answers:{...STORY_SAMPLE_ANSWERS,q1:'Новая ситуация'}})).response.status).toBe(402);
      expect(s.myth).toHaveBeenCalledTimes(1);
    }finally{s.close();}
  });
  it('crisis bypasses the provider and does not claim delivered commercial content',async()=>{
    const s=await setup();try{await s.consent();const r=await s.call('/api/personal-myth',{request_id:'crisis_myth_0001',answers:{...STORY_SAMPLE_ANSWERS,q1:'Я хочу покончить с собой'}});expect(r.data.status).toBe('crisis');expect(s.myth).not.toHaveBeenCalled();}finally{s.close();}
  });
  it('delete during a pending generator prevents late persistence and denies reopening',async()=>{
    const s=await setup();let resolve:any;
    s.myth.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    try{
      await s.consent();await s.call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});
      const pending=await s.call('/api/personal-myth',{request_id:'delayed_myth_001',answers:STORY_SAMPLE_ANSWERS});
      expect(pending.response.status).toBe(202);
      await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));
      expect((await s.call('/api/stories/delete',{confirmed:true})).data.deleted).toBe(true);
      resolve({status:'ok',story_result:STORY_SAMPLE_MYTH});
      await vi.waitFor(()=>expect(s.myth).toHaveBeenCalledTimes(1));
      expect((await s.call('/api/stories')).response.status).toBe(401);
      expect(s.store.db.prepare('SELECT payload FROM orders').get()).toMatchObject({payload:null});
    }finally{s.close();}
  });
  it('Yoo test requests freeze price/idempotency and reject a real-money object',async()=>{
    const transport=vi.fn(async(url:string,_init?:RequestInit)=>new Response(JSON.stringify(url.endsWith('/me')?{account_id:'test-shop',status:'enabled',test:true}:{test:false}),{status:200}));
    const adapter=new YooTestPayment({YOOKASSA_SHOP_ID:'test-shop',YOOKASSA_SECRET_KEY:'synthetic-not-a-secret',COMMERCE_PUBLIC_ORIGIN:'https://example.test'},transport as any);
    await expect(adapter.create({id:'order-1',test:1,payment_started:Date.now()} as any)).rejects.toThrow('test_shop_required');
    const init=transport.mock.calls[1][1] as RequestInit;
    expect(init.headers).toMatchObject({'Idempotence-Key':'order-1'});
    expect(JSON.parse(init.body as string)).toMatchObject({amount:{value:'790.00',currency:'RUB'},capture:true,metadata:{order_id:'order-1'}});
    expect(JSON.parse(init.body as string)).not.toHaveProperty('save_payment_method');
    await expect(adapter.create({id:'order-1',test:1,payment_started:Date.now()-86400000} as any)).rejects.toThrow('payment_uncertain_needs_support');
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
