import {AsyncLocalStorage} from 'node:async_hooks';
import crypto from 'node:crypto';
import tariffs from './aiTariffs.json';
import {CommerceError,CommerceStore} from './commerceStore';
import type {DeepSeekRequestOptions} from './deepseek';
import {budgetPolicy,estimateAttempt,maxAttempt,initialiseTariffs,currentTariffs,prepareTariffs} from './aiTariffService.mjs';

export const PAID_ATTEMPT_RESERVE=52; // 3 Myth operations *4 +10 Albert operations *4 (repair + fallback).
export const MAX_ATTEMPT_MICRO=maxAttempt(tariffs);
export const PAID_COST_RESERVE=PAID_ATTEMPT_RESERVE*MAX_ATTEMPT_MICRO;
type Scope={pool:'free'|'paid';orderId?:string};
const context=new AsyncLocalStorage<Scope>();
let runtime:AIBudget|undefined;
export const withAIBudget=<T>(scope:Scope,fn:()=>T):T=>context.run(scope,fn);
export const registerAIBudget=(value:AIBudget|undefined)=>{runtime=value;};
export const financialGuardRequired=()=>process.env.COMMERCE_ENABLED==='true'||process.env.COMMERCE_BUDGET_APPROVED==='true'||process.env.FREE_PREVIEW_ENABLED==='true';
const positive=(value:string|undefined)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw new CommerceError('ai_budget_unconfigured',503);return n;};
export function validateAIRequest(model:string,messages:unknown,maxTokens:number,now=Date.now()){
  try{return estimateAttempt(tariffs,model,messages,maxTokens,now).cost_micro;}catch(e){throw new CommerceError(e.message,e.message==='ai_input_bound_exceeded'?413:503);}
}
export class AIBudget {
  constructor(private store:()=>CommerceStore,private env:NodeJS.ProcessEnv,private transport:typeof fetch=fetch,private clock=Date.now){}
  configured(){return this.env.COMMERCE_BUDGET_APPROVED==='true';}
  db(){
    if(!this.configured())throw new CommerceError('ai_budget_unconfigured',503);
    if(this.store().db.prepare("SELECT 1 FROM configuration WHERE key='free_preview_pause_generations'").get())throw new CommerceError('free_budget_exhausted',503);
    const db=this.store();db.configureAIBudget({free:{limit_micro:positive(this.env.COMMERCE_FREE_BUDGET_RUB)*1e6,attempt_limit:positive(this.env.COMMERCE_FREE_ATTEMPT_MAX)},...(this.env.FREE_PREVIEW_ENABLED==='true'?{}:{paid:{limit_micro:positive(this.env.COMMERCE_PAID_BUDGET_RUB)*1e6,attempt_limit:positive(this.env.COMMERCE_PAID_ATTEMPT_MAX),order_limit:positive(this.env.COMMERCE_PAID_ORDER_MAX)}})});db.aiBudgetOpen();initialiseTariffs(db.db,tariffs);return db;
  }
  freeAvailability(){try{const db=this.db(),snapshot=currentTariffs(db.db);estimateAttempt(snapshot,tariffs.rows[0].model,[{role:'user',content:'availability check'}],1,this.clock());return db.freeBudgetAvailable(maxAttempt(snapshot));}catch{return {available:false,warning:false};}}
  async prepare(){const db=this.db();try{const snapshot=await prepareTariffs(db.db,this.transport,this.clock());const maximum=maxAttempt(snapshot);
      for(const row of db.db.prepare('SELECT * FROM ai_budget_commitments').all() as any[])if(row.spent_micro+Math.max(0,row.attempt_limit-row.attempts)*maximum>row.capacity_micro)db.recordBudgetIncident(row.order_id,'paid_service_waiting',snapshot.version);
      return snapshot;
    }catch(e){for(const row of db.db.prepare('SELECT order_id FROM ai_budget_commitments').all() as any[])db.recordBudgetIncident(row.order_id,'ai_tariffs_stale');db.recordBudgetIncident(context.getStore()?.orderId,'ai_tariffs_stale');throw new CommerceError('ai_tariffs_stale',503);}}
  reserve(model:string,options:DeepSeekRequestOptions){const scope=context.getStore()||{pool:'free' as const},db=this.db();let snapshot;
    try{snapshot=currentTariffs(db.db);const estimate=estimateAttempt(snapshot,model,options.messages,options.max_tokens??4000,this.clock(),options.response_format);return {db,id:db.reserveAI(scope.pool,scope.orderId,model,estimate.cost_micro,estimate.estimate_version,budgetPolicy.version,maxAttempt(snapshot))};}
    catch(e){const code=e.code||e.message;if(scope.pool==='paid')db.recordBudgetIncident(scope.orderId,code,snapshot?.version);throw e instanceof CommerceError?e:new CommerceError(code,code==='ai_input_bound_exceeded'?413:503);}
  }
  hold(account:string,id:string){const db=this.db(),snapshot=currentTariffs(db.db);estimateAttempt(snapshot,tariffs.rows[0].model,[{role:'user',content:'capacity check'}],1,this.clock());if(!db.paidLiabilitiesCovered(maxAttempt(snapshot)))throw new CommerceError('new_sales_paused',503);db.holdAIBudget(account,id,PAID_ATTEMPT_RESERVE*maxAttempt(snapshot),PAID_ATTEMPT_RESERVE,snapshot.version);}
  capacity(){try{const db=this.db(),snapshot=currentTariffs(db.db);estimateAttempt(snapshot,tariffs.rows[0].model,[{role:'user',content:'capacity check'}],1,this.clock());return db.paidLiabilitiesCovered(maxAttempt(snapshot))&&db.aiCapacity(PAID_ATTEMPT_RESERVE*maxAttempt(snapshot),PAID_ATTEMPT_RESERVE);}catch{return false;}}
  async dcsHeaders(url:string){
    await this.prepare(); // Refresh public prices; no model or payment I/O.
    const r=await fetch(url+'/health',{signal:AbortSignal.timeout(2000)});
    const binding=crypto.createHmac('sha256',this.env.COMMERCE_DATA_KEY||'').update('budget-db:'+this.db().filename).digest('hex');
    if(!r.ok||r.headers.get('x-ai-budget-schema')!=='1'||r.headers.get('x-ai-budget-policy')!==budgetPolicy.version||r.headers.get('x-ai-budget-fingerprint')!==binding)throw new CommerceError('dcs_budget_not_covered',503);
    const scope=context.getStore()||{pool:'free' as const};
    const data=Buffer.from(JSON.stringify({...scope,at:Date.now()})).toString('base64url');
    const signature=crypto.createHmac('sha256',this.env.COMMERCE_DATA_KEY||'').update(data).digest('hex');
    return {'X-AI-Budget-Scope':data+'.'+signature};
  }
}
export async function reserveProviderAttempt(model:string,options:DeepSeekRequestOptions){
  if(!financialGuardRequired())return undefined;
  if(!runtime)throw new CommerceError('ai_budget_unconfigured',503);
  await runtime.prepare();return runtime.reserve(model,options);
}
export async function dcsBudgetHeaders(url:string){
  if(!financialGuardRequired())return {};
  if(!runtime)throw new CommerceError('ai_budget_unconfigured',503);
  return runtime.dcsHeaders(url);
}
