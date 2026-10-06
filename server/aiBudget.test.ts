// @vitest-environment node
import {it,expect,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
import {CommerceStore} from './commerceStore';import {STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH} from './storySample';
import {AIBudget,MAX_ATTEMPT_MICRO,PAID_COST_RESERVE,PAID_ATTEMPT_RESERVE,validateAIRequest,registerAIBudget,withAIBudget} from './aiBudget';
import {RouterAIClient,PRIMARY_MODEL,FALLBACK_MODEL} from './routerai';
import {backupStories,restoreStories} from '../scripts/story_backup';
import {PYTHON_BUDGET_CLOCK} from '../tests/budgetClock';
import seed from './aiTariffs.json';import {initialiseTariffs} from './aiTariffService.mjs';
const directory=()=>fs.mkdtempSync(path.join(os.tmpdir(),'story-budget-'));const encryption='f'.repeat(64);
const policy={free:{limit_micro:MAX_ATTEMPT_MICRO*2,attempt_limit:2},paid:{limit_micro:PAID_COST_RESERVE,attempt_limit:PAID_ATTEMPT_RESERVE,order_limit:1}};
const env={COMMERCE_BUDGET_APPROVED:'true',COMMERCE_FREE_BUDGET_RUB:String(Math.ceil(policy.free.limit_micro/1e6)),COMMERCE_FREE_ATTEMPT_MAX:'2',COMMERCE_PAID_BUDGET_RUB:String(Math.ceil(policy.paid.limit_micro/1e6)),COMMERCE_PAID_ATTEMPT_MAX:String(PAID_ATTEMPT_RESERVE),COMMERCE_PAID_ORDER_MAX:'1',COMMERCE_DATA_KEY:encryption};
const paid=(db:CommerceStore)=>{const a=db.createAccount(true);db.importFree(a.id,STORY_SAMPLE_ANSWERS,STORY_SAMPLE_MYTH);const o=db.createOrder(a.id,'paid_budget_test','paid',true);return {a,o};};
const pay=(db:CommerceStore,a:string,id:string)=>{db.attachPayment(a,id,'payment_'+id,'https://yoomoney.ru/test');db.confirmPayment(a,id,{id:'payment_'+id,status:'succeeded',paid:true,test:true,amount:{value:'790.00',currency:'RUB'},metadata:{order_id:id}});};
afterEach(()=>{registerAIBudget(undefined);delete process.env.COMMERCE_ENABLED;});
it('free exhaustion cannot spend the protected paid commitment; unknown outcomes never refund reservations',()=>{
 const db=new CommerceStore(':memory:',encryption);db.configureAIBudget(policy);const {a,o}=paid(db);db.holdAIBudget(a.id,o.id,PAID_COST_RESERVE,PAID_ATTEMPT_RESERVE);pay(db,a.id,o.id);
 const first=db.reserveAI('free',undefined,PRIMARY_MODEL,MAX_ATTEMPT_MICRO);db.finishAI(first,false);db.reserveAI('free',undefined,PRIMARY_MODEL,MAX_ATTEMPT_MICRO);
 expect(()=>db.reserveAI('free',undefined,PRIMARY_MODEL,1)).toThrow('free_budget_exhausted');expect(()=>db.reserveAI('paid',o.id,FALLBACK_MODEL,MAX_ATTEMPT_MICRO)).not.toThrow();expect(db.aiCapacity(PAID_COST_RESERVE,PAID_ATTEMPT_RESERVE)).toBe(false);expect(()=>db.holdAIBudget(a.id,o.id,1,1)).not.toThrow();db.close();
});
it('restart retains attempts and reservations; unfinished attempt becomes uncertain, policy cannot silently refill',()=>{
 const file=path.join(directory(),'stories.sqlite');let db=new CommerceStore(file,encryption);db.configureAIBudget(policy);db.reserveAI('free',undefined,PRIMARY_MODEL,MAX_ATTEMPT_MICRO);db.close();
 db=new CommerceStore(file,encryption);db.configureAIBudget(policy);expect((db.db.prepare('SELECT state FROM ai_budget_attempts').get() as any).state).toBe('uncertain');db.reserveAI('free',undefined,FALLBACK_MODEL,MAX_ATTEMPT_MICRO);expect(()=>db.reserveAI('free',undefined,PRIMARY_MODEL,1)).toThrow();expect(()=>db.configureAIBudget({...policy,free:{...policy.free,attempt_limit:100}})).toThrow('ai_budget_policy_changed_needs_review');db.close();
});
it('Web actual I/O hooks account failure, retry and fallback; paid context survives async waits',async()=>{
 const db=new CommerceStore(':memory:',encryption);const b=new AIBudget(()=>db,env);b.db();registerAIBudget(b);process.env.COMMERCE_ENABLED='true';const {a,o}=paid(db);b.hold(a.id,o.id);pay(db,a.id,o.id);
 let calls=0;const transport=(async()=>{calls++;if(calls===1)throw new DOMException('timed out','TimeoutError');return new Response(JSON.stringify({provider:'Claude Platform on AWS',model:FALLBACK_MODEL,usage:{cost:7},choices:[{message:{content:'synthetic'},finish_reason:'stop'}]}));}) as typeof fetch;
 const client=new RouterAIClient({ROUTERAI_API_KEY:'synthetic-not-a-secret'},PRIMARY_MODEL,transport,()=>{});
 await withAIBudget({pool:'paid',orderId:o.id},async()=>{await Promise.resolve();await expect(client.call({messages:[{role:'user',content:'synthetic'}],max_tokens:100})).rejects.toThrow('provider_call_timeout');await expect(client.fallback()!.call({messages:[{role:'user',content:'synthetic'}],max_tokens:100})).resolves.toBe('synthetic');});
 expect(calls).toBe(2);const rows=db.db.prepare('SELECT pool,state FROM ai_budget_attempts ORDER BY created_at').all();expect(rows).toEqual([{pool:'paid',state:'uncertain'},{pool:'paid',state:'complete'}]);db.close();
});
it('bounds fail before transport, stale/unknown pricing cannot open sales',()=>{
 expect(()=>validateAIRequest('unknown',[{role:'user',content:'x'}],1)).toThrow('ai_price_bound_unknown');expect(()=>validateAIRequest(PRIMARY_MODEL,[{role:'user',content:'x'.repeat(65536)}],1)).toThrow('ai_input_bound_exceeded');expect(()=>validateAIRequest(PRIMARY_MODEL,[{role:'user',content:'x'}],8001)).toThrow();expect(()=>validateAIRequest(PRIMARY_MODEL,[{role:'user',content:'x'}],1,Date.now()+86400001)).toThrow('ai_tariffs_stale');
 const db=new CommerceStore(':memory:',encryption);expect(new AIBudget(()=>db,{}).capacity()).toBe(false);db.close();
});
it('native DCS seam and concurrent processes share the same atomic SQLite ceiling, no external I/O',async()=>{
 const filename=path.join(directory(),'stories.sqlite');const db=new CommerceStore(filename,encryption);db.configureAIBudget(policy);initialiseTariffs(db.db,seed);
 const dcs=process.env.DCS_ROOT||'/Users/artemkrysin/Documents/Zerkalo-Independent-Audit/work/release-first-sales-dcs-de78';const python=process.env.PYTHON_BIN||path.join(dcs,'.venv/bin/python');
 const script=path.resolve('scripts/quality/dcs_budget_bootstrap.py');
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('budget',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)${PYTHON_BUDGET_CLOCK}\nbody={'model':'${PRIMARY_MODEL}','messages':[{'role':'user','content':'synthetic'}],'max_tokens':100}\ntry:\n i=m.reserve(body,{'pool':'free'}); print(json.dumps({'reserved':True}))\nexcept RuntimeError as e: print(json.dumps({'reserved':False,'error':str(e)}))`;
 const child=()=>new Promise<any>((resolve,reject)=>{const p=spawn(python,['-c',code],{cwd:dcs,env:{...process.env,...env,COMMERCE_DB_PATH:filename,ROUTERAI_API_KEY:'',GOOGLE_API_KEY:'',GEMINI_API_KEY:'',TELEGRAM_V2_ALBERT_API_KEY:'',FIRST_SALES_PROXY_URL:''}});let stdout='',stderr='';p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.on('error',reject);p.on('exit',c=>{if(c!==0)return reject(Error(stderr));try{resolve(JSON.parse(stdout.trim().split('\n').at(-1)!));}catch{reject(Error(stdout+stderr))}});});
 const outcomes=await Promise.all(Array.from({length:5},child));expect(outcomes.filter(x=>x.reserved)).toHaveLength(2);expect(outcomes.filter(x=>!x.reserved).every(x=>x.error==='free_budget_exhausted')).toBe(true);expect((db.db.prepare('SELECT COUNT(*) AS n FROM ai_budget_attempts').get() as any).n).toBe(2);db.close();
});
it('operation failure does not consume a successful reply; paid operation bypasses free daily exhaustion',()=>{
 const db=new CommerceStore(':memory:',encryption);const {a,o}=paid(db);pay(db,a.id,o.id);db.saveAnswers(a.id,o.id,{...STORY_SAMPLE_ANSWERS,q1:'Different synthetic situation'},'');db.reserve(a.id,o.id,'myth_success','myth',{answers:'synthetic'});db.complete(a.id,o.id,'myth_success',{status:'ok',story_result:STORY_SAMPLE_MYTH});
 process.env.COMMERCE_DAILY_OPERATION_MAX='1';expect(db.reserve(a.id,o.id,'reply_failed','albert',{message:'synthetic'}).state).toBe('reserved');db.fail(a.id,o.id,'reply_failed');expect(db.order(a.id,o.id).remaining).toBe(5);expect(db.reserve(a.id,o.id,'reply_retry','albert',{message:'synthetic'}).state).toBe('reserved');db.fail(a.id,o.id,'reply_retry');delete process.env.COMMERCE_DAILY_OPERATION_MAX;db.close();
});
it('DCS actual transport wrapper accounts timeout and fallback independently without calling a provider',async()=>{
 const filename=path.join(directory(),'stories.sqlite');const db=new CommerceStore(filename,encryption);db.configureAIBudget(policy);initialiseTariffs(db.db,seed);
 const dcs=process.env.DCS_ROOT||'/Users/artemkrysin/Documents/Zerkalo-Independent-Audit/work/release-first-sales-dcs-de78';const python=process.env.PYTHON_BIN||path.join(dcs,'.venv/bin/python');const script=path.resolve('scripts/quality/dcs_budget_bootstrap.py');
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('budget',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)${PYTHON_BUDGET_CLOCK}\ncalls=[]\ndef fake(body,key,timeout,transport):\n calls.append(body['model'])\n if len(calls)==1: raise TimeoutError('synthetic timeout')\n return type('Response',(),{'status_code':200})()\nm.native_post=fake\nbody={'model':'${PRIMARY_MODEL}','messages':[{'role':'user','content':'synthetic'}],'max_tokens':100}\ntry: m.routerai._bounded_post(body,'synthetic',1,None)\nexcept TimeoutError: pass\nbody['model']='${FALLBACK_MODEL}'\nm.routerai._bounded_post(body,'synthetic',1,None)\nassert len(calls)==2\nprint(json.dumps({'synthetic_transport_calls':len(calls)}))`;
 await new Promise<void>((resolve,reject)=>{const p=spawn(python,['-c',code],{cwd:dcs,env:{...process.env,...env,COMMERCE_DB_PATH:filename,ROUTERAI_API_KEY:'',GOOGLE_API_KEY:'',GEMINI_API_KEY:'',TELEGRAM_V2_ALBERT_API_KEY:'',FIRST_SALES_PROXY_URL:''}});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(err)));});
 expect(db.db.prepare('SELECT model,state FROM ai_budget_attempts ORDER BY created_at').all()).toEqual([{model:PRIMARY_MODEL,state:'uncertain'},{model:FALLBACK_MODEL,state:'complete'}]);db.close();
});
it('recovery preserves later deletions/refund revocation and fails closed for unknown finance; never overwrites newer obligations',()=>{
 const folder=directory(),filename=path.join(folder,'current.sqlite');let db=new CommerceStore(filename,encryption);db.configureAIBudget(policy);const deleted=paid(db),refunded=paid(db);pay(db,refunded.a.id,refunded.o.id);db.reserveAI('free',undefined,PRIMARY_MODEL,MAX_ATTEMPT_MICRO);
 const snapshot=backupStories(db,path.join(folder,'snapshot'));db.deleteAccount(deleted.a.id);db.markRefunded(refunded.a.id,refunded.o.id);db.close();
 expect(()=>restoreStories(snapshot,filename,encryption,filename+'.deletions.jsonl',filename+'.revocations.jsonl')).toThrow('restore_target_exists');
 const target=path.join(folder,'restore.sqlite');expect(restoreStories(snapshot,target,encryption,filename+'.deletions.jsonl',filename+'.revocations.jsonl').financial_reconciliation_required).toBe(true);db=new CommerceStore(target,encryption);expect(db.account(deleted.a.access)).toBe(null);expect(db.order(refunded.a.id,refunded.o.id).state).toBe('refunded');expect(()=>db.reserveAI('free',undefined,PRIMARY_MODEL,1)).toThrow('ai_budget_recovery_waiting');db.close();
 expect(()=>restoreStories(snapshot,path.join(folder,'unknown.sqlite'),encryption,'missing','missing')).toThrow('current_revocations_required');
});
