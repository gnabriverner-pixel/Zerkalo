// @vitest-environment node
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import tariffs from './aiTariffs.json';
import {once} from 'node:events';import express from 'express';import crypto from 'node:crypto';
import {CommerceStore} from './commerceStore';import {FreePreview} from './freePreview';
import {installConsentRoutes} from './consent';import {installStoryCommerce} from './storyCommerce';
import {CONSENT_VERSION} from '../src/services/consent';
import {STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH} from './storySample';
import {AIBudget} from './aiBudget';
import {ownerCookieValid,ownerCookieValue,keyMatches} from './ownerMode';
const key='f'.repeat(64);
const OWNER_KEY='synthetic-owner-key-for-tests';
const OWNER_HASH=crypto.createHash('sha256').update(OWNER_KEY).digest('hex');
const env={FREE_PREVIEW_ENABLED:'true',FREE_PREVIEW_SUPPORT_URL:'https://t.me/synthetic_help',COMMERCE_BUDGET_APPROVED:'true',COMMERCE_FREE_BUDGET_RUB:'1000',COMMERCE_FREE_ATTEMPT_MAX:'8',COMMERCE_PAYMENT_MODE:'disabled'};
// Budget fixtures are only valid near the captured tariff snapshot (same fixed clock as tests/setup.ts uses for other commerce suites).
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(Date.parse(tariffs.captured_at)+3600000);});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
const OTHER={q1:'Другой синтетический ответ один',q2:'Другой синтетический ответ два',q3:'Другой синтетический ответ три',q4:'Другой синтетический ответ четыре'};
async function setup(extra:Record<string,string>={},albertImpl?:()=>Promise<any>){
  for(const [k,v] of Object.entries({...env,...extra}))vi.stubEnv(k,v);
  const store=new CommerceStore(':memory:',key),app=express();app.use(express.json());installConsentRoutes(app);
  new AIBudget(()=>store,env).db();new FreePreview(()=>store,env).activate();
  const myth=vi.fn(async()=>({status:'ok',story_result:STORY_SAMPLE_MYTH}));
  const albert=vi.fn(albertImpl||(async()=>({status:'ok',response:'Синтетический ответ.'})));
  installStoryCommerce(app,{store,myth,albert,ready:()=>true});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;let cookies='';
  const call=async(url:string,body?:any,headers:Record<string,string>={})=>{
    const r=await fetch(origin+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookies,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    for(const value of r.headers.getSetCookie()){const pair=value.split(';')[0],name=pair.split('=')[0];cookies=cookies.split('; ').filter(v=>!v.startsWith(name+'=')).concat(pair).join('; ');}
    const text=await r.text();let json:any;try{json=JSON.parse(text);}catch{json=undefined;}
    return {status:r.status,body:json,text,headers:r.headers};
  };
  const consent=()=>call('/api/consent',{accepted:true,adult:true,version:CONSENT_VERSION,scope:'core'});
  const probe=async()=>JSON.stringify((await call('/api/free-preview')).body);
  const issue=async(id='hotfix_myth_0001',answers:any=STORY_SAMPLE_ANSWERS)=>{
    await call('/api/personal-myth',{request_id:id,answers});
    await vi.waitFor(async()=>{expect((await call('/api/personal-myth',{request_id:id,answers})).status).toBe(200);});
  };
  return {store,myth,albert,call,consent,issue,probe,close:()=>{server.close();server.closeAllConnections();store.close();}};
}
describe('honest Myth error messages',()=>{
  it('different answers after an issued free story: 402 free_story_already_issued, open_saved action, no generation',async()=>{
    const s=await setup();try{
      await s.consent();await s.issue();
      const r=await s.call('/api/personal-myth',{request_id:'hotfix_myth_0002',answers:OTHER});
      expect(r.status).toBe(402);expect(r.body.code).toBe('free_story_already_issued');expect(r.body.ui.action).toBe('open_saved');expect(s.myth).toHaveBeenCalledTimes(1);
    }finally{s.close();}
  });
  it('issued story in a non-ready state never surfaces as bare answers_locked',async()=>{
    const s=await setup();try{
      await s.consent();await s.issue();
      s.store.db.prepare("UPDATE orders SET state='generation_failed'").run();
      const r=await s.call('/api/personal-myth',{request_id:'hotfix_myth_0003',answers:OTHER});
      expect(r.body.code).toBe('free_story_already_issued');
    }finally{s.close();}
  });
  it('answers_locked is mapped to the truthful text with the open-saved action',async()=>{
    const s=await setup();try{
      await s.consent();await s.issue();await s.call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});
      const order=(await s.call('/api/stories')).body.orders[0];
      const r=await s.call(`/api/stories/${order.id}/answers`,{request_key:'hotfix_answers_01',answers:OTHER});
      expect(r.status).toBe(409);expect(r.body.code).toBe('answers_locked');
      expect(r.body.ui.safe_message).toBe('Бесплатная история в этом браузере уже создана — она в разделе «Мои мифы».');expect(r.body.ui.action).toBe('open_saved');
    }finally{s.close();}
  });
  it('retry action only where repeating can help; none elsewhere',async()=>{
    const s=await setup();try{
      await s.consent();
      const busy=await s.call('/api/stories/restore',{recovery:'x'});// recovery_invalid: repeat cannot help
      expect(busy.body.code).toBe('recovery_invalid');expect(busy.body.ui.action).toBe('none');
      const noAcc=await s.call('/api/stories/recovery',{});expect(noAcc.body.code).toBe('account_required');expect(noAcc.body.ui.action).toBe('none');
    }finally{s.close();}
  });
  it('unknown code: support text, support action, and commerce_unmapped warning without answers',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const s=await setup({COMMERCE_SUPPORT_EMAIL:'help@example.test'},async()=>{throw new Error('provider_exploded');});
    try{
      await s.consent();await s.issue();await s.call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});
      const order=(await s.call('/api/stories')).body.orders[0];
      const r=await s.call(`/api/stories/${order.id}/albert`,{request_key:'hotfix_albert_001',message:'Привет, это синтетика'});
      expect(r.body.ui.safe_message).toBe('Не получилось создать историю. Ваши ответы сохранены. Напишите в поддержку — мы увидим причину.');
      expect(r.body.ui.action).toBe('support');expect(r.body.ui.support_email).toBe('help@example.test');
      const call=warn.mock.calls.find(c=>c[0]==='commerce_unmapped');expect(call).toBeTruthy();expect(call![1]).toEqual({route:'/api/stories/:id/albert',code:'story_delivery_failed'});
      expect(JSON.stringify(warn.mock.calls)).not.toContain('Привет');
    }finally{s.close();}
  });
  it('GET /api/stories does not claim owner mode without the cookie',async()=>{
    const s=await setup();try{await s.consent();await s.issue();expect((await s.call('/api/stories')).body.owner_test).toBeUndefined();}finally{s.close();}
  });
});
describe('owner service mode',()=>{
  it('without OWNER_TEST_KEY_SHA256 the page, unlock and recovery return 404',async()=>{
    const s=await setup();try{expect((await s.call('/api/owner/recovery')).status).toBe(404);expect((await s.call('/owner')).status).toBe(404);expect((await s.call('/api/owner/unlock',{key:OWNER_KEY})).status).toBe(404);}finally{s.close();}
  });
  it('/owner is noindex and has one key field; wrong key is 403 and rate limited; key is never logged',async()=>{
    const logs=[vi.spyOn(console,'warn').mockImplementation(()=>{}),vi.spyOn(console,'log').mockImplementation(()=>{}),vi.spyOn(console,'error').mockImplementation(()=>{})];
    const s=await setup({OWNER_TEST_KEY_SHA256:OWNER_HASH});try{
      const page=await s.call('/owner');expect(page.status).toBe(200);expect(page.headers.get('x-robots-tag')).toContain('noindex');expect(page.text).toContain('noindex');expect(page.text).toContain('Служебный ключ');expect(page.text).toContain('Каждый новый Миф — в новом служебном доступе; код восстановления показывается после создания.');
      for(let i=0;i<5;i++){const r=await s.call('/api/owner/unlock',{key:'wrong-key-'+i});expect(r.status).toBe(403);expect(r.headers.get('set-cookie')).toBeNull();}
      expect((await s.call('/api/owner/unlock',{key:OWNER_KEY})).status).toBe(429);// even the right key is throttled after 5 attempts
      const all=JSON.stringify(logs.map(l=>l.mock.calls));expect(all).not.toContain('wrong-key');expect(all).not.toContain(OWNER_KEY);expect(all).not.toContain(OWNER_HASH);
    }finally{s.close();}
  });
  it('cross-origin unlock is rejected',async()=>{
    const s=await setup({OWNER_TEST_KEY_SHA256:OWNER_HASH});try{expect((await s.call('/api/owner/unlock',{key:OWNER_KEY},{Origin:'https://evil.example'})).status).toBe(403);}finally{s.close();}
  });
  it('without cookie the one-free-story limit holds; with cookie each new Myth gets a new test-marked access',async()=>{
    const s=await setup({OWNER_TEST_KEY_SHA256:OWNER_HASH});try{
      await s.consent();await s.issue();
      const blocked=await s.call('/api/personal-myth',{request_id:'hotfix_myth_0002',answers:OTHER});expect(blocked.body.code).toBe('free_story_already_issued');expect(s.myth).toHaveBeenCalledTimes(1);
      const un=await s.call('/api/owner/unlock',{key:OWNER_KEY});expect(un.status).toBe(200);
      const setCookie=un.headers.getSetCookie().join(';');expect(setCookie).toContain('zerkalo_owner=');expect(setCookie.toLowerCase()).toContain('httponly');expect(setCookie).toContain('Max-Age=604800');
      await s.issue('hotfix_myth_0002',OTHER);expect(s.myth).toHaveBeenCalledTimes(2);
      await s.issue('hotfix_myth_0003',{...OTHER,q1:'Третий синтетический ответ'});expect(s.myth).toHaveBeenCalledTimes(3);
      const orders=(await s.call('/api/stories')).body;expect(orders.owner_test).toBe(true);
      // each new Myth lives in its own new access: the browser sees only the latest one, the one-free-per-access index is untouched
      expect(orders.orders.filter((o:any)=>o.kind==='free')).toHaveLength(1);
      expect(s.store.db.prepare("SELECT COUNT(*) AS n FROM accounts").get()).toEqual({n:3});
      expect(s.store.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE kind='free'").get()).toEqual({n:3});
      expect(s.store.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE kind='free' AND test=1").get()).toEqual({n:3});// all test here (non-production env); owner orders are always test
      expect(s.store.db.prepare("SELECT COUNT(*) AS n FROM events WHERE name='issued' AND test=1").get()).toEqual({n:3});// all test here (non-production env); owner orders are always test
      // polling the same request id does not spawn more accesses
      expect((await s.call('/api/personal-myth',{request_id:'hotfix_myth_0003',answers:{...OTHER,q1:'Третий синтетический ответ'}})).status).toBe(200);
      expect(s.store.db.prepare("SELECT COUNT(*) AS n FROM accounts").get()).toEqual({n:3});
      // schema unchanged: old code reads the same database
      const idx=(s.store.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'one_free%'").all() as any[]).map(r=>r.name);expect(idx).toEqual(['one_free']);
      const rec=await s.call('/api/owner/recovery');expect(rec.status).toBe(200);expect(rec.body.recovery).toMatch(/^[\w-]{43}$/);
    }finally{s.close();}
  });
  it('owner mode does not lift the window budget',async()=>{
    const s=await setup({OWNER_TEST_KEY_SHA256:OWNER_HASH});try{
      await s.consent();await s.call('/api/owner/unlock',{key:OWNER_KEY});await s.issue();
      s.store.db.prepare("UPDATE ai_budget_limits SET limit_micro=1 WHERE pool='free'").run();
      const r=await s.call('/api/personal-myth',{request_id:'hotfix_myth_0009',answers:OTHER});expect(r.body.code).toBe('free_budget_exhausted');
    }finally{s.close();}
  });
  it('cookie is signed, expires and is bound to the configured key',()=>{
    const e={OWNER_TEST_KEY_SHA256:OWNER_HASH} as any,now=1_800_000_000_000,v=ownerCookieValue(e,now);
    expect(ownerCookieValid(v,e,now+1000)).toBe(true);expect(ownerCookieValid(v,e,now+8*86400000)).toBe(false);
    expect(ownerCookieValid(v.slice(0,-1)+(v.endsWith('0')?'1':'0'),e,now+1000)).toBe(false);
    expect(ownerCookieValid(v,{OWNER_TEST_KEY_SHA256:'a'.repeat(64)} as any,now+1000)).toBe(false);
    expect(ownerCookieValid(v,{} as any,now+1000)).toBe(false);
    expect(keyMatches(OWNER_KEY,e)).toBe(true);expect(keyMatches('nope',e)).toBe(false);expect(keyMatches(undefined,e)).toBe(false);
  });
});
