import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {backup} from 'node:sqlite';
import {CommerceStore} from './commerceStore';
import {STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH} from './storySample';
const secret='b'.repeat(64);
const ok={status:'ok',story_result:STORY_SAMPLE_MYTH};
function setup(filename=':memory:'){
  const store=new CommerceStore(filename,secret),a=store.createAccount(true);
  let free=store.createOrder(a.id,'free_request_0001','free',true);
  free=store.saveAnswers(a.id,free.id,STORY_SAMPLE_ANSWERS,'');
  store.reserve(a.id,free.id,'free_request_0001','myth',{answers:free.data.answers});store.complete(a.id,free.id,'free_request_0001',ok);
  const paid=store.createOrder(a.id,'paid_request_0001','paid',true);
  store.paymentStarted(a.id,paid.id);store.attachPayment(a.id,paid.id,'payment-1','https://yoomoney.ru/test');
  const payment={id:'payment-1',status:'succeeded',paid:true,test:true,amount:{value:'790.00',currency:'RUB'},metadata:{order_id:paid.id}};
  return {store,a,free,paid,payment};
}
describe('server owned personal story rights',()=>{
  it('requires separate storage agreement and never revives expired temporary free text',()=>{
    const store=new CommerceStore(':memory:',secret),a=store.createAccount();
    let free=store.createOrder(a.id,'temporary_free_001','free',true);store.saveAnswers(a.id,free.id,STORY_SAMPLE_ANSWERS,'');
    store.reserve(a.id,free.id,'temporary_free_001','myth',{});store.complete(a.id,free.id,'temporary_free_001',ok);
    expect(()=>store.recovery(a.id)).toThrow('storage_consent_required');
    expect(()=>store.createOrder(a.id,'paid_request_00001','paid',true)).toThrow('storage_consent_required');
    store.db.prepare('UPDATE orders SET payload_expires=? WHERE id=?').run(Date.now()-1,free.id);
    store.acceptStorage(a.id);expect(store.order(a.id,free.id).data.myth).toBeUndefined();
    expect(store.order(a.id,free.id).state).toBe('ready');expect(store.storageAccepted(a.id)).toBe(true);store.close();
  });
  it('does not issue rights from a redirect, wrong amount, currency, order, test flag or paid:false',()=>{
    const {store,a,paid,payment}=setup();
    expect(()=>store.reserve(a.id,paid.id,'myth_00000001','myth',{})).toThrow('myth_not_available');
    for(const change of [{amount:{value:'1.00',currency:'RUB'}},{amount:{value:'790.00',currency:'USD'}},{metadata:{order_id:'other'}},{test:false},{id:'other'}])expect(()=>store.confirmPayment(a.id,paid.id,{...payment,...change})).toThrow('payment_mismatch');
    store.confirmPayment(a.id,paid.id,{...payment,paid:false});expect(store.order(a.id,paid.id).state).toBe('pending_payment');
    store.confirmPayment(a.id,paid.id,payment);store.confirmPayment(a.id,paid.id,payment);
    expect(store.order(a.id,paid.id).state).toBe('paid');
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM events WHERE name='server_confirmed'").get()).toMatchObject({n:1});store.close();
  });
  it('reuses a pending purchase across new browser request keys, then handles cancellation',()=>{
    const {store,a,paid,payment}=setup();
    expect(store.createOrder(a.id,'another_request_01','paid',true).id).toBe(paid.id);
    store.confirmPayment(a.id,paid.id,{...payment,status:'canceled',paid:false});
    expect(store.order(a.id,paid.id).state).toBe('canceled');
    expect(()=>store.reserve(a.id,paid.id,'myth_00000001','myth',{})).toThrow();store.close();
  });
  it('requires new answers and preserves the first free result',()=>{
    const {store,a,free,paid,payment}=setup();store.confirmPayment(a.id,paid.id,payment);
    expect(()=>store.saveAnswers(a.id,paid.id,STORY_SAMPLE_ANSWERS,'')).toThrow('new_answers_required');
    expect(store.order(a.id,free.id).data.myth).toEqual(STORY_SAMPLE_MYTH);
    expect(store.createOrder(a.id,'new_free_key_01','free',true).id).toBe(free.id);store.close();
  });
  it('charges exactly five successful Albert replies, serializes races and replays without another debit',()=>{
    const {store,a,paid,payment}=setup();store.confirmPayment(a.id,paid.id,payment);
    const answers={...STORY_SAMPLE_ANSWERS,q1:'Новая вымышленная ситуация'};
    store.saveAnswers(a.id,paid.id,answers,'Вопрос человека');
    store.reserve(a.id,paid.id,'myth_00000001','myth',{answers});store.complete(a.id,paid.id,'myth_00000001',ok);
    store.reserve(a.id,paid.id,'albert_failed01','albert',{message:'вопрос'});store.fail(a.id,paid.id,'albert_failed01');
    store.reserve(a.id,paid.id,'albert_crisis01','albert',{message:'кризис'});store.complete(a.id,paid.id,'albert_crisis01',{status:'crisis'});
    expect(store.order(a.id,paid.id).remaining).toBe(5);
    for(let i=0;i<5;i++){
      const key=`albert_${i}_000001`,input={message:`Вопрос ${i}`};
      expect(store.reserve(a.id,paid.id,key,'albert',input).state).toBe('reserved');
      expect(store.reserve(a.id,paid.id,key,'albert',input).state).toBe('running');
      expect(()=>store.reserve(a.id,paid.id,key+'x','albert',input)).toThrow(/operation_in_progress|albert_limit/);
      store.complete(a.id,paid.id,key,{status:'ok',reply:`Ответ ${i}`},input.message);
      expect(store.reserve(a.id,paid.id,key,'albert',input)).toMatchObject({state:'complete',result:{reply:`Ответ ${i}`}});
      expect(()=>store.reserve(a.id,paid.id,key,'albert',{message:'другой'})).toThrow('request_key_conflict');
    }
    expect(store.order(a.id,paid.id).remaining).toBe(0);expect(store.order(a.id,paid.id).data.messages).toHaveLength(10);
    expect(()=>store.reserve(a.id,paid.id,'sixth_00000001','albert',{})).toThrow('albert_limit');store.close();
  });
  it('survives restart, encrypts personal text and restores with a capability, not an order ID',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'story-store-')),filename=path.join(dir,'stories.sqlite');
    const {store,a,free}=setup(filename);store.note(a.id,free.id,'секретная личная заметка');store.close();
    expect(fs.readFileSync(filename).includes(Buffer.from('секретная личная заметка'))).toBe(false);
    expect(()=>new CommerceStore(filename,'a'.repeat(64))).toThrow('commerce_key_changed');
    const restarted=new CommerceStore(filename,secret);
    expect(restarted.account(a.access)).toBe(a.id);expect(()=>restarted.restore(free.id)).toThrow('recovery_invalid');
    const restored=restarted.restore(a.recovery);expect(restarted.account(a.access)).toBeNull();expect(restarted.account(restored.access)).toBe(a.id);
    expect(restarted.order(a.id,free.id).data.note).toBe('секретная личная заметка');
    const stranger=restarted.createAccount();expect(()=>restarted.order(stranger.id,free.id)).toThrow('story_not_found');
    restarted.close();fs.rmSync(dir,{recursive:true});
  });
  it('retains interrupted operations without an automatic generation or debit',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'story-restart-')),filename=path.join(dir,'db.sqlite');
    const {store,a,paid,payment}=setup(filename);store.confirmPayment(a.id,paid.id,payment);
    store.saveAnswers(a.id,paid.id,{...STORY_SAMPLE_ANSWERS,q1:'Новые ответы'},'');store.reserve(a.id,paid.id,'myth_00000001','myth',{});store.close();
    const restarted=new CommerceStore(filename,secret);
    expect(restarted.reserve(a.id,paid.id,'myth_00000001','myth',{}).state).toBe('uncertain');
    expect(()=>restarted.reserve(a.id,paid.id,'myth_00000002','myth',{})).toThrow();
    restarted.acknowledgeUncertain(a.id,paid.id);expect(restarted.reserve(a.id,paid.id,'myth_00000002','myth',{}).state).toBe('reserved');
    restarted.close();fs.rmSync(dir,{recursive:true});
  });
  it('deletion and refund revoke late success; recovery cannot resurrect deleted data',()=>{
    for(const deleting of [false,true]){
      const {store,a,paid,payment}=setup();store.confirmPayment(a.id,paid.id,payment);
      store.saveAnswers(a.id,paid.id,{...STORY_SAMPLE_ANSWERS,q1:'Новые ответы'},'');store.reserve(a.id,paid.id,'myth_00000001','myth',{});
      if(deleting)store.deleteAccount(a.id);else store.markRefunded(a.id,paid.id);
      expect(()=>store.complete(a.id,paid.id,'myth_00000001',ok)).toThrow();
      if(deleting){expect(()=>store.restore(a.recovery)).toThrow();expect(store.account(a.access)).toBeNull();expect(store.db.prepare('SELECT payload FROM orders WHERE id=?').get(paid.id)).toMatchObject({payload:null});}
      store.close();
    }
  });
  it('restores a SQLite backup with quota intact and reapplies the independent deletion journal',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'story-backup-')),filename=path.join(dir,'db.sqlite'),snapshot=path.join(dir,'snapshot.sqlite');
    const {store,a,free}=setup(filename);store.note(a.id,free.id,'Сохранённая заметка');
    await backup(store.db,snapshot);store.close();
    fs.copyFileSync(snapshot,filename);let restored=new CommerceStore(filename,secret);
    expect(restored.order(a.id,free.id).data.note).toBe('Сохранённая заметка');
    expect(restored.order(a.id,free.id).remaining).toBe(5);restored.deleteAccount(a.id);restored.close();
    fs.copyFileSync(snapshot,filename);restored=new CommerceStore(filename,secret);
    expect(restored.account(a.access)).toBeNull();expect(()=>restored.restore(a.recovery)).toThrow();
    expect(restored.db.prepare('SELECT payload FROM orders WHERE id=?').get(free.id)).toMatchObject({payload:null});
    restored.close();fs.rmSync(dir,{recursive:true});
  });
});
