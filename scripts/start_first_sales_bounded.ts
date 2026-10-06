import fs from 'node:fs';
import dotenv from 'dotenv';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startFirstSalesProxy} from './quality/firstSalesProxy';
// Only this candidate's owner-entered .env is allowed to supply credentials.
const ownerEnv=dotenv.parse(fs.readFileSync(path.resolve('.env')));
Object.assign(process.env,ownerEnv);
process.env.ROUTERAI_API_KEY=ownerEnv.ROUTERAI_API_KEY||'';
if(process.env.NODE_ENV==='production')throw new Error('bounded_smoke_local_only');
// Fixed shared ledger outside checkout: a new SHA/restart never resets the authorised 8 attempts.
const ledger='/Users/artemkrysin/Documents/Zerkalo-Independent-Audit/runtime/release-first-sales-2026-10-06/provider-attempts.json';
const freeSmoke=process.argv.includes('--free-preview-smoke');
if(freeSmoke&&(process.env.COMMERCE_BUDGET_APPROVED!=='true'||process.env.FREE_PREVIEW_SMOKE_APPROVED!=='true'))throw new Error('separate_financial_and_live_smoke_approval_required');
// Absolute stop 4 = the preserved historical 2 attempts plus the newly authorised maximum 2.
// Restart cannot grant another two; the historical ledger limit remains 8.
const proxy=await startFirstSalesProxy(ledger,process.env.ROUTERAI_API_KEY||'',fetch,freeSmoke?4:8);
const child=spawn(process.execPath,['scripts/run_stage1_pair.cjs','--bounded-live',...process.argv.slice(2).filter(arg=>arg!=='--free-preview-smoke')],{
  cwd:path.resolve('.'),stdio:'inherit',env:{...process.env,FIRST_SALES_PROXY_URL:proxy.origin,GOOGLE_API_KEY:'',GEMINI_API_KEY:'',TELEGRAM_V2_ALBERT_API_KEY:''},
});
console.info('BOUNDED_SMOKE_GATE_ACTIVE limit=8; stop_at='+String(freeSmoke?4:8)+'; Web/DCS/retries/fallback share one durable ledger');
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>child.kill(signal));
child.once('exit',async code=>{await proxy.close();process.exit(code||0);});
