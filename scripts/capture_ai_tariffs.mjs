import fs from 'node:fs';
const models=['deepseek/deepseek-v4.1-flash','anthropic/claude-sonnet-5','openai/gpt-5.4-mini'];
const captured_at=new Date().toISOString();const rows=[];
for(const model of models){
 const source='https://routerai.ru/api/v1/models/'+model+'/endpoints';
 const r=await fetch(source,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('tariff_metadata_failed');
 const data=await r.json();const endpoints=data.data.endpoints;
 if(!endpoints.length||endpoints.some(e=>e.pricing_units?.prompt!=='token'||e.pricing_units?.completion!=='token'))throw Error('tariff_units_unknown');
 const input_rate=Math.max(...endpoints.flatMap(e=>[e.pricing.prompt,e.pricing.input_cache_write||0,...e.variable_pricings.map(v=>v.prompt||0)]));
 const output_rate=Math.max(...endpoints.flatMap(e=>[e.pricing.completion,...e.variable_pricings.map(v=>v.completion||0)]));
 const input_tokens=Math.max(...endpoints.map(e=>e.context_length));const output_tokens=Math.max(...endpoints.map(e=>e.max_completion_tokens));
 if([input_rate,output_rate,input_tokens,output_tokens].some(x=>!Number.isFinite(x)||x<=0))throw Error('tariff_bound_unknown');
 // Full endpoint token ceilings avoid asserting a tokenizer/hidden-reasoning bound.
 const reserve_micro_rub=Math.ceil((input_rate*input_tokens+output_rate*output_tokens)*1.25*1e6);
 rows.push({model,source,input_rate,output_rate,input_tokens,output_tokens,reserve_micro_rub,endpoints});
}
fs.writeFileSync('server/aiTariffs.json',JSON.stringify({captured_at,currency:'RUB',valid_for_ms:86400000,margin:1.25,rows},null,2)+'\n');
console.log(JSON.stringify({captured_at,models:rows.map(({model,reserve_micro_rub})=>({model,reserve_rub:reserve_micro_rub/1e6}))}));
