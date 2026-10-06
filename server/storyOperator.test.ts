// @vitest-environment node
import {it,expect} from 'vitest';import express from 'express';import {once} from 'node:events';
import {CommerceStore} from './commerceStore';import {installStoryCommerce} from './storyCommerce';import {MockStoryPayment} from './storyPayment';import {STORY_SAMPLE_MYTH,STORY_SAMPLE_ANSWERS} from './storySample';
it('operator finds an unissued paid order and refund request; verification and explicit retry do not generate or send money',async()=>{
 process.env.LOCAL_STORY_SETUP='true';const db=new CommerceStore(':memory:','f'.repeat(64));const a=db.createAccount(true);db.importFree(a.id,STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH);const order=db.createOrder(a.id,'operator_purchase','paid',true);const adapter=new MockStoryPayment();const payment=await adapter.create(order);db.attachPayment(a.id,order.id,payment.id,payment.confirmation!.confirmation_url!);adapter.decide(payment.id,true);
 let aiCalls=0;const app=express();app.use(express.json());installStoryCommerce(app,{store:db,payment:adapter,ready:()=>false,myth:async()=>{aiCalls++;throw Error()},albert:async()=>{aiCalls++;throw Error()}});const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;
 const action=async(action:string,extra:any={})=>fetch(origin+'/api/local-story-support/action',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({order_id:order.id,action,...extra})});
 try{
  expect((await action('verify_payment')).status).toBe(200);let queue=await fetch(origin+'/api/local-story-support').then(r=>r.json());expect(queue.requests.some((r:any)=>r.order_id===order.id&&r.state==='paid')).toBe(true);
  expect((await action('request_refund')).status).toBe(200);queue=await fetch(origin+'/api/local-story-support').then(r=>r.json());expect(queue.requests.some((r:any)=>r.reason==='refund')).toBe(true);expect(db.order(a.id,order.id).state).toBe('paid');
  expect((await action('acknowledge_interrupted')).status).toBe(400);expect((await action('acknowledge_interrupted',{confirmed:true})).status).toBe(200);expect(aiCalls).toBe(0);
  const denied=await fetch(origin+'/api/local-story-support/action',{method:'POST',headers:{Origin:'https://stranger.invalid','Content-Type':'application/json'},body:JSON.stringify({order_id:order.id,action:'verify_payment'})});expect(denied.status).toBe(403);
 }finally{server.close();server.closeAllConnections();db.close();delete process.env.LOCAL_STORY_SETUP;}
});
