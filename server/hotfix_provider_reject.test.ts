// @vitest-environment node
import {describe,it,expect,afterEach,beforeEach,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {CommerceStore} from './commerceStore';
import {AIBudget,registerAIBudget,withAIBudget} from './aiBudget';
import {RouterAIClient,PRIMARY_MODEL} from './routerai';
import {resolveAlbertModel} from './albertModel';
import tariffs from './aiTariffs.json';
import {PYTHON_BUDGET_CLOCK} from '../tests/budgetClock';
const key='f'.repeat(64);
const env={FREE_PREVIEW_ENABLED:'true',COMMERCE_BUDGET_APPROVED:'true',COMMERCE_FREE_BUDGET_RUB:'1000',COMMERCE_FREE_ATTEMPT_MAX:'8'};
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(Date.parse(tariffs.captured_at)+3600000);});
afterEach(()=>{registerAIBudget(undefined);delete process.env.COMMERCE_ENABLED;vi.restoreAllMocks();});
const callWith=async(status:number)=>{
  const db=new CommerceStore(':memory:',key);const b=new AIBudget(()=>db,env);b.db();registerAIBudget(b);process.env.COMMERCE_ENABLED='true';
  const transport=(async()=>new Response('{"error":"no endpoints"}',{status})) as typeof fetch;
  const client=new RouterAIClient({ROUTERAI_API_KEY:'synthetic-not-a-secret'},PRIMARY_MODEL,transport,()=>{});
  await withAIBudget({pool:'free'},async()=>{await expect(client.call({messages:[{role:'user',content:'synthetic'}],max_tokens:100})).rejects.toThrow(`provider_http_${status}`);});
  const rows=db.db.prepare('SELECT state,cost_micro,outcome FROM ai_budget_attempts').all() as any[];const avail=db.freeBudgetAvailable(0);db.close();return {rows,avail};
};
describe('definite provider refusals release the reserve',()=>{
  it('404 and 402 release the attempt (no cost, outcome recorded)',async()=>{
    for(const status of [404,402]){const {rows,avail}=await callWith(status);expect(rows).toEqual([{state:'released',cost_micro:0,outcome:`provider_rejected_http_${status}`}]);expect(avail.used_micro).toBe(0);}
  });
  it('5xx stays uncertain (the call may have been billed)',async()=>{
    const {rows}=await callWith(503);expect(rows).toHaveLength(1);expect(rows[0].state).toBe('uncertain');
  });
  it('native DCS seam (Albert path): 404 releases, 503 stays uncertain',()=>{
    const root=process.env.DCS_ROOT||'/Users/artemkrysin/Documents/Zerkalo-Independent-Audit/work/release-first-sales-dcs-de78';
    const python=path.join(root,'.venv/bin/python');if(!fs.existsSync(python))return;
    const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'reject-python-')),'test.sqlite'),db=new CommerceStore(filename,key);new AIBudget(()=>db,env).db();
    const code=`import importlib.util,json,sqlite3\ns=importlib.util.spec_from_file_location('budget',${JSON.stringify(path.resolve('scripts/quality/dcs_budget_bootstrap.py'))});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)${PYTHON_BUDGET_CLOCK}\nbody={'model':'${PRIMARY_MODEL}','messages':[{'role':'user','content':'synthetic'}],'max_tokens':100}\nfor code in (404,503):\n m.native_post=lambda *a,c=code:type('R',(),{'status_code':c,'json':lambda self:{}})()\n r=m.accounted_post(body,'synthetic',1,None);assert r.status_code==code\nwith sqlite3.connect(m.DB) as d:\n rows=d.execute('SELECT state,cost_micro,outcome FROM ai_budget_attempts ORDER BY created_at').fetchall()\nprint(json.dumps(rows))`;
    try{const run=spawnSync(python,['-c',code],{cwd:root,env:{...process.env,...env,COMMERCE_DB_PATH:filename,ROUTERAI_API_KEY:'',GOOGLE_API_KEY:'',GEMINI_API_KEY:'',TELEGRAM_V2_ALBERT_API_KEY:'',FIRST_SALES_PROXY_URL:''},encoding:'utf8'});expect(run.status,run.stderr).toBe(0);
      const rows=JSON.parse(run.stdout.trim().split('\n').pop()!);expect(rows[0]).toEqual(['released',0,'provider_rejected_http_404']);expect(rows[1][0]).toBe('uncertain');}finally{db.close();}
  });
});
describe('ALBERT_MODEL',()=>{
  it('defaults to the current model; accepts a priced model; ignores an unpriced one',()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    expect(resolveAlbertModel({} as any)).toBe(PRIMARY_MODEL);
    expect(resolveAlbertModel({ALBERT_MODEL:'anthropic/claude-sonnet-5'} as any)).toBe('anthropic/claude-sonnet-5');
    expect(resolveAlbertModel({ALBERT_MODEL:'deepseek/unknown-model'} as any)).toBe(PRIMARY_MODEL);expect(warn).toHaveBeenCalledWith('albert_model_ignored',{reason:'no_tariff_row'});
  });
});
