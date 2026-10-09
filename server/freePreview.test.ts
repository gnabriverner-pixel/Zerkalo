// @vitest-environment node
import {describe,it,expect,vi,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {once} from 'node:events';import express from 'express';
import {CommerceStore} from './commerceStore';import {FreePreview,previewSupport} from './freePreview';
import {installConsentRoutes} from './consent';import {installStoryCommerce} from './storyCommerce';
import {CONSENT_VERSION} from '../src/services/consent';
import {STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH} from './storySample';
import {AIBudget} from './aiBudget';
import {spawnSync} from 'node:child_process';
import {PRIMARY_MODEL} from './routerai';
import {PYTHON_BUDGET_CLOCK} from '../tests/budgetClock';
const key='f'.repeat(64);
const env={FREE_PREVIEW_ENABLED:'true',FREE_PREVIEW_SUPPORT_URL:'https://t.me/synthetic_help',COMMERCE_BUDGET_APPROVED:'true',COMMERCE_FREE_BUDGET_RUB:'1000',COMMERCE_FREE_ATTEMPT_MAX:'8',COMMERCE_PAYMENT_MODE:'disabled',LOCAL_STORY_SETUP:'true'};
afterEach(()=>vi.unstubAllEnvs());
async function setup(){
  for(const [k,v] of Object.entries(env))vi.stubEnv(k,v);
  const store=new CommerceStore(':memory:',key),app=express();app.use(express.json());installConsentRoutes(app);
  new AIBudget(()=>store,env).db();new FreePreview(()=>store,env).activate();
  const myth=vi.fn(async()=>({status:'ok',story_result:STORY_SAMPLE_MYTH})),albert=vi.fn(async()=>({status:'ok',response:'Синтетический обычный ответ.'}));
  installStoryCommerce(app,{store,myth,albert,ready:()=>true});
  app.post('/api/personal-myth',(_req,res)=>res.json({legacy_branch:true}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;let cookies='';
  const call=async(url:string,body?:any)=>{
    const r=await fetch(origin+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookies,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    for(const value of r.headers.getSetCookie()){const pair=value.split(';')[0],name=pair.split('=')[0];cookies=cookies.split('; ').filter(v=>!v.startsWith(name+'=')).concat(pair).join('; ');}
    return {status:r.status,body:r.headers.get('content-type')?.includes('application/pdf')?Buffer.from(await r.arrayBuffer()):await r.json()};
  };
  const consent=()=>call('/api/consent',{accepted:true,adult:true,version:CONSENT_VERSION,scope:'core'});
  const issue=async()=>{await consent();await call('/api/personal-myth',{request_id:'preview_myth_001',answers:STORY_SAMPLE_ANSWERS});await call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});return (await call('/api/stories')).body.orders[0];};
  return {store,myth,albert,call,consent,issue,clearCookies:()=>{cookies='';},close:()=>{server.close();server.closeAllConnections();store.close();}};
}
describe('bounded free preview, synthetic only',()=>{
  it('operator opens only an explicitly approved window and read-only summaries never alter attempts or leak feedback',()=>{
    const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'preview-control-')),'test.sqlite'),db=new CommerceStore(filename,key);new AIBudget(()=>db,env).db();
    const a=db.createAccount(true),o=db.importFree(a.id,STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH);db.previewFeedback(a.id,o.id,'ОТДЕЛЬНЫЙ ДОБРОВОЛЬНЫЙ ОТЗЫВ');const attempt=db.reserveAI('free',undefined,PRIMARY_MODEL,1);
    const cli=(args:string[])=>spawnSync(process.execPath,['--import','tsx',path.resolve('scripts/free_preview_control.ts'),'--db',filename,...args],{env:{...process.env,...env,COMMERCE_DATA_KEY:key},encoding:'utf8'});
    try{const summary=cli([]);expect(summary.status,summary.stderr).toBe(0);expect(summary.stdout).not.toContain('ОТДЕЛЬНЫЙ ДОБРОВОЛЬНЫЙ ОТЗЫВ');expect(db.db.prepare('SELECT state FROM ai_budget_attempts WHERE id=?').get(attempt)).toEqual({state:'reserved'});expect(cli(['--activate']).status).not.toBe(0);expect(cli(['--activate','--confirm-public-opening','--confirmed-budget-rub','500','--support-url',env.FREE_PREVIEW_SUPPORT_URL]).status).not.toBe(0);expect(cli(['--activate','--confirm-public-opening','--confirmed-budget-rub','1000','--support-url',env.FREE_PREVIEW_SUPPORT_URL]).status).toBe(0);expect(cli(['--activate','--confirm-public-opening','--confirmed-budget-rub','1000','--support-url',env.FREE_PREVIEW_SUPPORT_URL]).status).not.toBe(0);expect(cli(['--feedback']).status).not.toBe(0);expect(cli(['--feedback','--private-consented-feedback']).stdout).toContain('ОТДЕЛЬНЫЙ ДОБРОВОЛЬНЫЙ ОТЗЫВ');expect(cli(['--pause-generations']).status).toBe(0);expect(new AIBudget(()=>db,env).freeAvailability().available).toBe(false);}finally{db.close();}
  });
  it('native Python reservations enforce two in-flight calls before I/O and tolerate missing usage',()=>{
    const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'preview-python-')),'test.sqlite'),db=new CommerceStore(filename,key);new AIBudget(()=>db,env).db();
    const root=process.env.DCS_ROOT||'/Users/artemkrysin/Documents/Zerkalo-Independent-Audit/work/release-first-sales-dcs-de78';
    const code=`import importlib.util,json,sqlite3\ns=importlib.util.spec_from_file_location('budget',${JSON.stringify(path.resolve('scripts/quality/dcs_budget_bootstrap.py'))});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)${PYTHON_BUDGET_CLOCK}\nbody={'model':'${PRIMARY_MODEL}','messages':[{'role':'user','content':'synthetic'}],'max_tokens':100}\na=m.reserve(body,{'pool':'free'});b=m.reserve(body,{'pool':'free'})\ntry:\n m.reserve(body,{'pool':'free'});raise AssertionError('third reservation allowed')\nexcept RuntimeError as e:assert str(e)=='ai_concurrency_limit'\nwith sqlite3.connect(m.DB) as d:d.execute("UPDATE ai_budget_attempts SET state='complete'")\nm.native_post=lambda *args:type('R',(),{'status_code':200,'json':lambda self:{'usage':[]}})()\nm.accounted_post(body,'synthetic',1,None)\nwith sqlite3.connect(m.DB) as d:\n row=d.execute('SELECT input_tokens,output_tokens,usage_cost,usage_currency FROM ai_budget_attempts ORDER BY created_at DESC LIMIT 1').fetchone();assert row==(None,None,None,'UNKNOWN'),row\nprint(json.dumps({'native_cap':'PASS','unknown_usage':'PASS','actual_external_calls':0}))`;
    try{const run=spawnSync(path.join(root,'.venv/bin/python'),['-c',code],{cwd:root,env:{...process.env,...env,COMMERCE_DB_PATH:filename,ROUTERAI_API_KEY:'',GOOGLE_API_KEY:'',GEMINI_API_KEY:'',TELEGRAM_V2_ALBERT_API_KEY:'',FIRST_SALES_PROXY_URL:''},encoding:'utf8'});expect(run.status,run.stderr).toBe(0);expect(JSON.parse(run.stdout.trim())).toMatchObject({native_cap:'PASS',unknown_usage:'PASS',actual_external_calls:0});}finally{db.close();}
  });
  it('free preview refuses payment and exposes a free delivery support request to the operator',async()=>{
    const s=await setup();try{const order=await s.issue();expect((await s.call('/api/stories/orders',{request_key:'preview_payment_01'})).body.code).toBe('preview_payment_disabled');await s.call(`/api/stories/${order.id}/support`,{reason:'delivery'});expect((await s.call('/api/local-story-support')).body.requests).toEqual(expect.arrayContaining([expect.objectContaining({order_id:order.id,reason:'delivery'})]));}finally{s.close();}
  });
  it('persists a five-day actual-start window, rejects restart/reset and expires without erasing archive',()=>{
    let now=Date.now();const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'preview-window-')),'test.sqlite');
    let db=new CommerceStore(filename,key);let p=new FreePreview(()=>db,env,()=>now);expect(p.status().phase).toBe('not_started');const window=p.activate();expect(window.ends_at-window.started_at).toBe(5*86400000);db.close();
    db=new CommerceStore(filename,key);p=new FreePreview(()=>db,env,()=>now);expect(p.status().started_at).toBe(window.started_at);expect(()=>p.activate()).toThrow('preview_already_started');now=window.ends_at;expect(p.status().phase).toBe('ended');db.close();
  });
  it('requires approved configuration and an exact support contact; no invented contact',()=>{
    const db=new CommerceStore(':memory:',key);try{expect(()=>new FreePreview(()=>db,{...env,COMMERCE_BUDGET_APPROVED:'false'}).activate()).toThrow('preview_not_approved');expect(()=>new FreePreview(()=>db,{...env,FREE_PREVIEW_SUPPORT_URL:''}).activate()).toThrow('preview_support_missing');expect(previewSupport('javascript:alert(1)')).toBeNull();}finally{db.close();}
  });
  it('has persistent 70% warning and atomic refusal at the accounting boundary, without participant quota',()=>{
    const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'preview-budget-')),'test.sqlite');let db=new CommerceStore(filename,key);db.configureAIBudget({free:{limit_micro:1000000,attempt_limit:8}});
    db.reserveAI('free',undefined,'synthetic',700000);expect(db.freeBudgetAvailable(0).warning).toBe(true);expect(db.budgetSummary().incidents).toEqual(expect.arrayContaining([expect.objectContaining({reason:'free_budget_warning_70_percent'})]));db.close();
    db=new CommerceStore(filename,key);expect(db.freeBudgetAvailable(300001).available).toBe(false);db.reserveAI('free',undefined,'synthetic',300000);expect(()=>db.reserveAI('free',undefined,'synthetic',1)).toThrow('free_budget_exhausted');expect(db.freeBudgetAvailable(1).used_micro).toBe(1000000);db.close();
  });
  it('limits actual reservations to two and preserves unknown usage as null',()=>{
    vi.stubEnv('FREE_PREVIEW_ENABLED','true');const db=new CommerceStore(':memory:',key);try{db.configureAIBudget({free:{limit_micro:1000000,attempt_limit:8}});const a=db.reserveAI('free',undefined,'synthetic',1),b=db.reserveAI('free',undefined,'synthetic',1);expect(()=>db.reserveAI('free',undefined,'synthetic',1)).toThrow('ai_concurrency_limit');db.finishAI(a,true,{usageCost:null,usageCostCurrency:'UNKNOWN'});expect(db.db.prepare('SELECT usage_cost,input_tokens,output_tokens,usage_currency FROM ai_budget_attempts WHERE id=?').get(a)).toEqual({usage_cost:null,input_tokens:null,output_tokens:null,usage_currency:'UNKNOWN'});expect(db.reserveAI('free',undefined,'synthetic',1)).toBeTypeOf('string');db.finishAI(b,false);}finally{db.close();}
  });
  it('consent, replay and recovery preserve one experience; changed answers cannot create a second',async()=>{
    const s=await setup();try{expect((await s.call('/api/personal-myth',{request_id:'preview_myth_001',answers:STORY_SAMPLE_ANSWERS})).status).toBe(403);expect(s.myth).not.toHaveBeenCalled();const order=await s.issue();expect(order.preview_temporary).toBe(true);expect((await s.call('/api/personal-myth',{request_id:'preview_replay_01',answers:STORY_SAMPLE_ANSWERS})).body.replayed).toBe(true);expect(s.myth).toHaveBeenCalledTimes(1);expect((await s.call('/api/personal-myth',{request_id:'preview_second_01',answers:{...STORY_SAMPLE_ANSWERS,q1:'Иная ситуация'}})).status).toBe(402);const recovery=(await s.call('/api/stories/recovery',{})).body.recovery;s.clearCookies();await s.consent();expect((await s.call('/api/stories/restore',{recovery})).status).toBe(200);expect((await s.call('/api/stories')).body.orders).toHaveLength(1);expect(s.myth).toHaveBeenCalledTimes(1);}finally{s.close();}
  });
  it('parallel requests do not create two generations; five delivered replies and no sixth',async()=>{
    const s=await setup();let finish:any;s.myth.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));try{await s.consent();await s.call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});const pending=s.call('/api/personal-myth',{request_id:'preview_myth_001',answers:STORY_SAMPLE_ANSWERS});await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));const second=await s.call('/api/personal-myth',{request_id:'preview_myth_002',answers:STORY_SAMPLE_ANSWERS});expect(second.status).toBe(409);expect(s.myth).toHaveBeenCalledTimes(1);finish({status:'ok',story_result:STORY_SAMPLE_MYTH});await pending;const order=(await s.call('/api/stories')).body.orders[0];for(let i=0;i<5;i++)expect((await s.call(`/api/stories/${order.id}/albert`,{request_key:'preview_reply_'+i,message:'Вымышленный вопрос.'})).body.order.remaining).toBe(4-i);expect((await s.call(`/api/stories/${order.id}/albert`,{request_key:'preview_sixth_01',message:'Ещё вопрос.'})).body.code).toBe('albert_limit');expect(s.albert).toHaveBeenCalledTimes(5);}finally{s.close();}
  });
  it('same request_id while running returns 202 without a second generation, then replays the finished story',async()=>{
    const s=await setup();let finish:any;s.myth.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));try{await s.consent();await s.call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});const body={request_id:'preview_myth_001',answers:STORY_SAMPLE_ANSWERS};const pending=s.call('/api/personal-myth',body);await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));for(let i=0;i<3;i++){const again=await s.call('/api/personal-myth',body);expect(again.status).toBe(202);expect(again.body.status).toBe('running');expect(again.body.story_result).toBeUndefined();}expect(s.myth).toHaveBeenCalledTimes(1);finish({status:'ok',story_result:STORY_SAMPLE_MYTH});expect((await pending).body.story_result.title).toBe(STORY_SAMPLE_MYTH.title);const replay=await s.call('/api/personal-myth',body);expect(replay.status).toBe(200);expect(replay.body.replayed).toBe(true);expect(replay.body.story_result.title).toBe(STORY_SAMPLE_MYTH.title);expect(s.myth).toHaveBeenCalledTimes(1);}finally{s.close();}
  });
  it('re-POST of the same request_id: failed/uncertain/expired never start a second call; a lost cookie does (why "check" is a GET)',async()=>{
    const s=await setup();try{
      await s.consent();const body={request_id:'preview_myth_001',answers:STORY_SAMPLE_ANSWERS};
      // read-only list without a cookie: 401, creates no account
      expect((await s.call('/api/stories')).status).toBe(401);
      // failed -> same key answers 202 failed, no new call
      s.myth.mockRejectedValueOnce(new Error('provider down'));
      expect((await s.call('/api/personal-myth',body)).status).toBe(502);
      for(let i=0;i<2;i++){const again=await s.call('/api/personal-myth',body);expect(again.status).toBe(202);expect(again.body.status).toBe('failed');}
      expect(s.myth).toHaveBeenCalledTimes(1);
      // uncertain (server restart) -> 202 uncertain, no new call
      s.store.db.prepare("UPDATE operations SET state='uncertain'").run();
      const un=await s.call('/api/personal-myth',body);expect(un.status).toBe(202);expect(un.body.status).toBe('uncertain');expect(s.myth).toHaveBeenCalledTimes(1);
    }finally{s.close();}
  });
  it('without storage consent the result is wiped after payload_expires: re-POST is refused with 402, the list shows ready without myth',async()=>{
    const s=await setup();try{
      await s.consent();const body={request_id:'preview_myth_001',answers:STORY_SAMPLE_ANSWERS};
      expect((await s.call('/api/personal-myth',body)).body.story_result.title).toBe(STORY_SAMPLE_MYTH.title);
      expect((await s.call('/api/stories/status')).body.storage_accepted).toBe(false);
      expect((await s.call('/api/stories')).body.orders[0].data.myth.title).toBe(STORY_SAMPLE_MYTH.title);
      s.store.db.prepare('UPDATE orders SET payload_expires=?').run(Date.now()-1);
      const again=await s.call('/api/personal-myth',body);expect(again.status).toBe(402);expect(again.body.code).toBe('free_story_already_issued');
      const listed=(await s.call('/api/stories')).body.orders[0];expect(listed.state).toBe('ready');expect(listed.data.myth).toBeUndefined();expect(listed.data.answers).toBeUndefined();
      expect(s.myth).toHaveBeenCalledTimes(1);
    }finally{s.close();}
  });
  it('HAZARD documented: the same request_id without the session cookie is a NEW account and a SECOND generation',async()=>{
    const s=await setup();try{
      await s.consent();const body={request_id:'preview_myth_001',answers:STORY_SAMPLE_ANSWERS};
      await s.call('/api/personal-myth',body);expect(s.myth).toHaveBeenCalledTimes(1);
      s.clearCookies();await s.consent();
      expect((await s.call('/api/stories')).status).toBe(401);
      expect((await s.call('/api/personal-myth',body)).status).toBe(200);
      expect(s.myth).toHaveBeenCalledTimes(2);
    }finally{s.close();}
  });
  it('expiry refuses only temporary continuation; archive/PDF and preexisting free route remain',async()=>{
    const s=await setup();try{const order=await s.issue();const window=JSON.parse((s.store.db.prepare("SELECT value FROM configuration WHERE key='free_preview_window'").get() as any).value);window.ends_at=Date.now()-1;s.store.db.prepare("UPDATE configuration SET value=? WHERE key='free_preview_window'").run(JSON.stringify(window));expect((await s.call(`/api/stories/${order.id}/albert`,{request_key:'preview_ended_01',message:'Вопрос после срока.'})).body.code).toBe('preview_ended');expect(s.albert).not.toHaveBeenCalled();expect((await s.call(`/api/stories/${order.id}/pdf`,{})).body.subarray(0,4).toString()).toBe('%PDF');expect((await s.call('/api/stories')).body.orders[0].data.myth.title).toBe(STORY_SAMPLE_MYTH.title);s.clearCookies();await s.consent();expect((await s.call('/api/personal-myth',{request_id:'after_preview_01',answers:STORY_SAMPLE_ANSWERS})).body.legacy_branch).toBe(true);}finally{s.close();}
  });
  it('budget pause precedes provider I/O and preserves already issued data',async()=>{
    const s=await setup();try{const order=await s.issue();s.store.db.prepare("UPDATE ai_budget_limits SET limit_micro=1 WHERE pool='free'").run();expect((await s.call('/api/free-preview')).body.can_start_myth).toBe(false);expect((await s.call(`/api/stories/${order.id}/albert`,{request_key:'preview_no_funds',message:'Вопрос.'})).body.code).toBe('free_budget_exhausted');expect(s.albert).not.toHaveBeenCalled();expect((await s.call('/api/stories')).body.orders[0].data.myth).toBeTruthy();}finally{s.close();}
  });
  it('feedback needs separate consent, stays encrypted and outside events, and deletion removes it and late replies',async()=>{
    const s=await setup();let finish:any;try{const order=await s.issue();const text='Вымышленный отзыв: стало ясно, что можно сообщить промежуточный результат.';expect((await s.call(`/api/stories/${order.id}/feedback`,{text})).status).toBe(403);expect((await s.call(`/api/stories/${order.id}/feedback`,{text,accepted:true,version:'free-preview-feedback-v1'})).body.saved).toBe(true);expect(JSON.stringify(s.store.db.prepare('SELECT * FROM preview_feedback').all())).not.toContain(text);expect(JSON.stringify((await s.call('/api/local-free-preview')).body)).not.toContain(text);expect((await s.call(`/api/stories/${order.id}/support`,{reason:'delivery'})).body.recorded).toBe(true);s.albert.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const pending=s.call(`/api/stories/${order.id}/albert`,{request_key:'preview_delete_1',message:'Отложенный вопрос.'});await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));expect((await s.call('/api/stories/delete',{confirmed:true})).body.deleted).toBe(true);finish({status:'ok',response:'ПОЗДНИЙ ТЕКСТ'});await pending;expect(s.store.db.prepare('SELECT COUNT(*) AS n FROM preview_feedback').get()).toMatchObject({n:0});expect(s.store.db.prepare('SELECT payload FROM orders').get()).toMatchObject({payload:null});expect((await s.call('/api/stories')).status).toBe(401);}finally{s.close();}
  });
});
