import {AsyncLocalStorage} from 'node:async_hooks';
import crypto from 'node:crypto';
import tariffs from './aiTariffs.json';
import {CommerceError,CommerceStore} from './commerceStore';
import type {DeepSeekRequestOptions} from './deepseek';

export const PAID_ATTEMPT_RESERVE=52; // 3 Myth operations *4 +10 Albert operations *4 (repair + fallback).
export const MAX_ATTEMPT_MICRO=Math.max(...tariffs.rows.map(row=>row.reserve_micro_rub));
export const PAID_COST_RESERVE=PAID_ATTEMPT_RESERVE*MAX_ATTEMPT_MICRO;
type Scope={pool:'free'|'paid';orderId?:string};
const context=new AsyncLocalStorage<Scope>();
let runtime:AIBudget|undefined;
export const withAIBudget=<T>(scope:Scope,fn:()=>T):T=>context.run(scope,fn);
export const registerAIBudget=(value:AIBudget|undefined)=>{runtime=value;};
export const financialGuardRequired=()=>process.env.COMMERCE_ENABLED==='true'||process.env.COMMERCE_BUDGET_APPROVED==='true';
const positive=(value:string|undefined)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw new CommerceError('ai_budget_unconfigured',503);return n;};
export function validateAIRequest(model:string,messages:unknown,maxTokens:number,now=Date.now()){
  if(now<Date.parse(tariffs.captured_at)||now-Date.parse(tariffs.captured_at)>tariffs.valid_for_ms)throw new CommerceError('ai_tariffs_stale',503);
  const row=tariffs.rows.find(r=>r.model===model);if(!row)throw new CommerceError('ai_price_bound_unknown',503);
  if(!Array.isArray(messages)||messages.length<1||messages.length>100||messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||Buffer.byteLength(JSON.stringify(messages),'utf8')>65536||!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>8000)throw new CommerceError('ai_input_bound_exceeded',413);
  return row.reserve_micro_rub;
}
export class AIBudget {
  constructor(private store:()=>CommerceStore,private env:NodeJS.ProcessEnv){}
  configured(){return this.env.COMMERCE_BUDGET_APPROVED==='true';}
  db(){
    if(!this.configured())throw new CommerceError('ai_budget_unconfigured',503);
    const db=this.store();db.configureAIBudget({free:{limit_micro:positive(this.env.COMMERCE_FREE_BUDGET_RUB)*1e6,attempt_limit:positive(this.env.COMMERCE_FREE_ATTEMPT_MAX)},paid:{limit_micro:positive(this.env.COMMERCE_PAID_BUDGET_RUB)*1e6,attempt_limit:positive(this.env.COMMERCE_PAID_ATTEMPT_MAX),order_limit:positive(this.env.COMMERCE_PAID_ORDER_MAX)}});db.aiBudgetOpen();return db;
  }
  reserve(model:string,options:DeepSeekRequestOptions){const cost=validateAIRequest(model,options.messages,options.max_tokens??4000);const scope=context.getStore()||{pool:'free' as const};const db=this.db();return {db,id:db.reserveAI(scope.pool,scope.orderId,model,cost)};}
  hold(account:string,id:string){validateAIRequest(tariffs.rows[0].model,[{role:'user',content:'capacity check'}],1);this.db().holdAIBudget(account,id,PAID_COST_RESERVE,PAID_ATTEMPT_RESERVE);}
  capacity(){try{validateAIRequest(tariffs.rows[0].model,[{role:'user',content:'capacity check'}],1);return this.db().aiCapacity(PAID_COST_RESERVE,PAID_ATTEMPT_RESERVE);}catch{return false;}}
  async dcsHeaders(url:string){
    this.db(); // No downstream I/O until the approved persistent policy exists.
    const r=await fetch(url+'/health',{signal:AbortSignal.timeout(2000)});
    const binding=crypto.createHmac('sha256',this.env.COMMERCE_DATA_KEY||'').update('budget-db:'+this.db().filename).digest('hex');
    if(!r.ok||r.headers.get('x-ai-budget-schema')!=='1'||r.headers.get('x-ai-budget-fingerprint')!==binding)throw new CommerceError('dcs_budget_not_covered',503);
    const scope=context.getStore()||{pool:'free' as const};
    const data=Buffer.from(JSON.stringify({...scope,at:Date.now()})).toString('base64url');
    const signature=crypto.createHmac('sha256',this.env.COMMERCE_DATA_KEY||'').update(data).digest('hex');
    return {'X-AI-Budget-Scope':data+'.'+signature};
  }
}
export function reserveProviderAttempt(model:string,options:DeepSeekRequestOptions){
  if(!financialGuardRequired())return undefined;
  if(!runtime)throw new CommerceError('ai_budget_unconfigured',503);
  return runtime.reserve(model,options);
}
export async function dcsBudgetHeaders(url:string){
  if(!financialGuardRequired())return {};
  if(!runtime)throw new CommerceError('ai_budget_unconfigured',503);
  return runtime.dcsHeaders(url);
}
