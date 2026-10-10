import crypto from 'node:crypto';
import policy from './aiBudgetPolicy.json' with {type:'json'};
const MODELS=['deepseek/deepseek-v4.1-flash','anthropic/claude-sonnet-5','openai/gpt-5.4-mini','anthropic/claude-opus-5.5'];
const TTL=86400000, REFRESH=43200000;
export const budgetPolicy=policy;
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function validateTariffs(snapshot,now=Date.now()){
  if(snapshot?.currency!=='RUB'||snapshot?.valid_for_ms!==TTL||!Array.isArray(snapshot.rows)||snapshot.rows.length!==MODELS.length)throw Error('ai_tariff_schema_invalid');
  const captured=Date.parse(snapshot.captured_at);
  if(!Number.isFinite(captured)||captured>now||snapshot.rows.some((r,i)=>r.model!==MODELS[i]||r.source!==`https://routerai.ru/api/v1/models/${r.model}/endpoints`||![r.input_rate,r.output_rate].every(positive)||!Array.isArray(r.endpoints)||!r.endpoints.length))throw Error('ai_tariff_schema_invalid');
  for(const row of snapshot.rows){
    const rates=endpointRates(row.endpoints);
    if(row.input_rate!==rates.input_rate||row.output_rate!==rates.output_rate)throw Error('ai_tariff_schema_invalid');
  }
  return snapshot;
}
export function endpointRates(endpoints){
  if(!Array.isArray(endpoints)||!endpoints.length)throw Error('ai_tariff_schema_invalid');
  const inputs=[],outputs=[];
  for(const e of endpoints){
    if(e.pricing_units?.prompt!=='token'||e.pricing_units?.completion!=='token'||!positive(e.context_length)||!positive(e.max_completion_tokens)||!positive(e.pricing?.prompt)||!positive(e.pricing?.completion)||!Array.isArray(e.variable_pricings))throw Error('ai_tariff_units_unknown');
    // No unaccounted search, request, image or separately priced reasoning charge.
    const allowed=new Set(['prompt','completion','input_cache_read','input_cache_write']);
    for(const [key,value] of Object.entries(e.pricing))if(!allowed.has(key)&&!(key==='web_search'&&e.pricing_units?.[key]==='request')&&Number(value)>0)throw Error('ai_tariff_charge_unknown');
    for(const [key,value] of Object.entries(e.pricing))if(allowed.has(key)&&(!Number.isFinite(value)||value<0||e.pricing_units?.[key]!=='token'))throw Error('ai_tariff_units_unknown');
    inputs.push(e.pricing.prompt,e.pricing.input_cache_write||0,e.pricing.input_cache_read||0);outputs.push(e.pricing.completion);
    for(const v of e.variable_pricings){
      const fields=['type','threshold','prompt','completion','input_cache_read','input_cache_write','utc_start','utc_end','utc_days'];
      if(Object.keys(v).some(k=>!fields.includes(k))||!['prompt-threshold','context-threshold','time-of-day'].includes(v.type)||
        (v.type==='time-of-day'?!Number.isFinite(v.utc_start)||!Number.isFinite(v.utc_end)||(v.utc_days!==undefined&&!Array.isArray(v.utc_days)):!positive(v.threshold)))throw Error('ai_tariff_variable_unknown');
      for(const key of ['prompt','completion','input_cache_read','input_cache_write'])if(v[key]!==undefined){if(!positive(v[key]))throw Error('ai_tariff_variable_unknown');(key==='completion'?outputs:inputs).push(v[key]);}
    }
  }
  return {input_rate:Math.max(...inputs),output_rate:Math.max(...outputs)};
}
export function estimateAttempt(snapshot,model,messages,maxTokens,now=Date.now(),responseFormat=undefined){
  const captured=Date.parse(snapshot.captured_at);if(!Number.isFinite(captured)||now<captured||now-captured>snapshot.valid_for_ms)throw Error('ai_tariffs_stale');
  const row=snapshot.rows.find(r=>r.model===model);if(!row)throw Error('ai_price_bound_unknown');
  if(!Array.isArray(messages)||messages.length<1||messages.length>policy.max_messages||messages.some(m=>!m||Object.keys(m).some(k=>!['role','content'].includes(k))||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(m.content))||!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>policy.max_output_tokens)throw Error('ai_input_bound_exceeded');
  // Canonical compact JSON in both languages; no average chars/word conversion.
  const bytes=Buffer.byteLength(JSON.stringify({messages,...(responseFormat?{response_format:responseFormat}:{})}),'utf8');if(bytes>policy.max_input_bytes)throw Error('ai_input_bound_exceeded');
  return {cost_micro:Math.ceil((bytes*row.input_rate+maxTokens*row.output_rate)*policy.margin_numerator/policy.margin_denominator*1e6),input_bytes:bytes,output_tokens:maxTokens,estimate_version:snapshot.version,policy_version:policy.version,strict_invoice_ceiling_verified:false};
}
export function maxAttempt(snapshot){return Math.max(...snapshot.rows.map(r=>Math.ceil((policy.max_input_bytes*r.input_rate+policy.max_output_tokens*r.output_rate)*policy.margin_numerator/policy.margin_denominator*1e6)));}
export function tariffVersion(snapshot){return crypto.createHash('sha256').update(JSON.stringify({captured_at:snapshot.captured_at,currency:snapshot.currency,rows:snapshot.rows.map(({model,input_rate,output_rate})=>({model,input_rate,output_rate}))})).digest('hex');}
export function initialiseTariffs(db,seed){
  db.exec('CREATE TABLE IF NOT EXISTS ai_tariff_versions(version TEXT PRIMARY KEY,snapshot TEXT NOT NULL,captured_at INTEGER NOT NULL);');
  if(!db.prepare("SELECT value FROM configuration WHERE key='ai_tariff_current'").get()){const value={...validateTariffs(seed),version:tariffVersion(seed)};acceptTariffs(db,value);}
}
export function currentTariffs(db){const current=db.prepare("SELECT value FROM configuration WHERE key='ai_tariff_current'").get();if(!current)throw Error('ai_tariffs_stale');const row=db.prepare('SELECT snapshot FROM ai_tariff_versions WHERE version=?').get(current.value);if(!row)throw Error('ai_tariffs_stale');return JSON.parse(row.snapshot);}
export function acceptTariffs(db,snapshot,now=Date.now()){
  validateTariffs(snapshot,now);snapshot={...snapshot,version:tariffVersion(snapshot)};db.exec('BEGIN IMMEDIATE');
  try{const old=db.prepare("SELECT value FROM configuration WHERE key='ai_tariff_current'").get();const previous=old&&db.prepare('SELECT captured_at FROM ai_tariff_versions WHERE version=?').get(old.value);
    db.prepare('INSERT OR IGNORE INTO ai_tariff_versions VALUES (?,?,?)').run(snapshot.version,JSON.stringify(snapshot),Date.parse(snapshot.captured_at));
    if(!previous||Date.parse(snapshot.captured_at)>previous.captured_at)db.prepare("INSERT INTO configuration VALUES ('ai_tariff_current',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(snapshot.version);
    db.exec('COMMIT');return currentTariffs(db);
  }catch(e){db.exec('ROLLBACK');throw e;}
}
export async function refreshTariffs(db,transport=fetch,now=Date.now()){
  const rows=[];
  for(const model of MODELS){const source=`https://routerai.ru/api/v1/models/${model}/endpoints`;const response=await transport(source,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('ai_tariff_source_unavailable');const data=await response.json();if(data?.data?.id!==model)throw Error('ai_tariff_model_changed');if(data.currency!==undefined&&data.currency!=='RUB')throw Error('ai_tariff_currency_changed');const endpoints=data.data.endpoints;rows.push({model,source,...endpointRates(endpoints),endpoints});}
  return acceptTariffs(db,{captured_at:new Date(now).toISOString(),currency:'RUB',valid_for_ms:TTL,rows},now);
}
const pending=new WeakMap();
export async function prepareTariffs(db,transport=fetch,now=Date.now()){
  const current=currentTariffs(db),age=now-Date.parse(current.captured_at);
  if(age>=0&&age<REFRESH)return current;
  const last=db.prepare("SELECT value FROM configuration WHERE key='ai_tariff_refresh_attempt'").get();
  if(last&&now>=Number(last.value)&&now-Number(last.value)<300000){if(age>=0&&age<=TTL)return current;throw Error('ai_tariffs_stale');}
  db.prepare("INSERT INTO configuration VALUES ('ai_tariff_refresh_attempt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(now));
  if(!pending.has(db))pending.set(db,refreshTariffs(db,transport,now).catch(error=>{const previous=currentTariffs(db);if(now>=Date.parse(previous.captured_at)&&now-Date.parse(previous.captured_at)<=TTL)return previous;throw error;}).finally(()=>pending.delete(db)));
  return pending.get(db);
}
