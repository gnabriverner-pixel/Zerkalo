// @vitest-environment node
import {it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import seed from './aiTariffs.json';
import {CommerceStore} from './commerceStore';import {AIBudget} from './aiBudget';
import {currentTariffs,acceptTariffs} from './aiTariffService.mjs';
const key='e'.repeat(64),base=Date.parse(seed.captured_at),start=base+13*3600000;
const env={FREE_PREVIEW_ENABLED:'true',COMMERCE_BUDGET_APPROVED:'true',COMMERCE_DATA_KEY:key,COMMERCE_FREE_BUDGET_RUB:'500',COMMERCE_FREE_ATTEMPT_MAX:'100'};

for(const mode of ['plus_one_ms','future','expired','invalid','failure_valid','failure_expired','clock_backwards'] as const){
  it('native refresh validates the accepted snapshot after I/O: '+mode,()=>{
    const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'refresh-clock-')),'test.sqlite'),db=new CommerceStore(filename,key);
    new AIBudget(()=>db,env,undefined,()=>base).db();
    const code=`import importlib.util,json,sqlite3,datetime
s=importlib.util.spec_from_file_location('b',${JSON.stringify(path.resolve('scripts/quality/dcs_budget_bootstrap.py'))});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
mode=${JSON.stringify(mode)};clock=[${start}];captures=[];m.time.time=lambda:clock[0]/1000
def fake_capture(*args,**kwargs):
 captures.append('local_fake_capture');clock[0]=${start}+2
 if mode=='failure_expired':clock[0]=${base}+86400001;raise RuntimeError('synthetic refresh failure')
 if mode=='failure_valid':raise RuntimeError('synthetic refresh failure')
 snapshot=m.current_tariffs();captured=${start}+1
 if mode=='future':captured=clock[0]+1
 if mode=='expired':captured=clock[0]-86400001
 if mode=='clock_backwards':clock[0]=${start}-1
 snapshot['captured_at']='invalid' if mode=='invalid' else datetime.datetime.fromtimestamp(captured/1000,datetime.timezone.utc).isoformat(timespec='milliseconds')
 snapshot['version']='local_fake_capture'
 with sqlite3.connect(m.DB) as d:
  d.execute('INSERT INTO ai_tariff_versions VALUES (?,?,?)',(snapshot['version'],json.dumps(snapshot),captured))
  d.execute("UPDATE configuration SET value=? WHERE key='ai_tariff_current'",(snapshot['version'],))
m.subprocess.run=fake_capture
body={'model':${JSON.stringify(seed.rows[0].model)},'messages':[{'role':'user','content':'synthetic'}],'max_tokens':100}
try:
 m.reserve(body,{'pool':'free'});result={'accepted':True}
except Exception as e:result={'accepted':False,'error':type(e).__name__,'message':str(e)}
with sqlite3.connect(m.DB) as d:result['attempts']=d.execute('SELECT COUNT(*) FROM ai_budget_attempts').fetchone()[0]
if result['accepted']:
 with sqlite3.connect(m.DB) as d:d.execute("UPDATE ai_budget_attempts SET state='complete'")
 m.reserve(body,{'pool':'free'})
result['captures']=len(captures);result['checked_at']=clock[0]
print(json.dumps(result))`;
    try{
      const run=spawnSync(process.env.PYTHON_BIN!,['-c',code],{cwd:process.env.DCS_ROOT,env:{...process.env,...env,COMMERCE_DB_PATH:filename,FIRST_SALES_PROXY_URL:''},encoding:'utf8'});
      expect(run.status,run.stderr).toBe(0);const result=JSON.parse(run.stdout.trim());
      const accepted=mode==='plus_one_ms'||mode==='failure_valid';expect(result.accepted).toBe(accepted);expect(result.attempts).toBe(accepted?1:0);
      expect(result.captures).toBe(mode==='failure_valid'?2:1);
      if(mode==='plus_one_ms')expect(result.checked_at).toBe(start+2);
      if(['future','expired','failure_expired','clock_backwards'].includes(mode))expect(result.message).toBe('ai_tariffs_stale');
    }finally{db.close();}
  });
}
it('Web validates after refresh/read, shares concurrent refresh and preserves the accepted version on reopening',async()=>{
  const filename=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'web-refresh-clock-')),'test.sqlite');let db=new CommerceStore(filename,key),clock=base,calls=0;
  const transport=(async(url:any)=>{calls++;const row=seed.rows.find(r=>r.source===String(url))!;
    if(calls===3){clock=start+2;acceptTariffs(db.db,{...seed,captured_at:new Date(start+1).toISOString()},clock);}
    return new Response(JSON.stringify({data:{id:row.model,endpoints:row.endpoints}}));}) as typeof fetch;
  const budget=new AIBudget(()=>db,env,transport,()=>clock);budget.db();clock=start;
  const [first,second]=await Promise.all([budget.prepare(),budget.prepare()]);expect(calls).toBe(seed.rows.length);expect(first.captured_at).toBe(new Date(start+1).toISOString());expect(second.captured_at).toBe(seed.captured_at);
  const reserved=budget.reserve(seed.rows[0].model,{messages:[{role:'user',content:'synthetic'}],max_tokens:100});expect(reserved.id).toBeTypeOf('string');
  db.close();db=new CommerceStore(filename,key);expect(currentTariffs(db.db).version).toBe(first.version);db.close();
});
it('Web refuses expired, future and invalid snapshots, including expiry while failed refresh was awaited',async()=>{
  const db=new CommerceStore(':memory:',key);let clock=base;
  const budget=new AIBudget(()=>db,env,(async()=>{clock=base+86400001;throw Error('synthetic refresh failure');}) as typeof fetch,()=>clock);budget.db();clock=start;
  await budget.prepare(); // A failed refresh may return the prior version; reserve must recheck it.
  expect(()=>budget.reserve(seed.rows[0].model,{messages:[{role:'user',content:'synthetic'}],max_tokens:100})).toThrow('ai_tariffs_stale');
  clock=base-1;expect(()=>budget.reserve(seed.rows[0].model,{messages:[{role:'user',content:'synthetic'}],max_tokens:100})).toThrow('ai_tariffs_stale');
  db.db.prepare('UPDATE ai_tariff_versions SET snapshot=?').run(JSON.stringify({...seed,captured_at:'invalid'}));
  expect(()=>budget.reserve(seed.rows[0].model,{messages:[{role:'user',content:'synthetic'}],max_tokens:100})).toThrow('ai_tariffs_stale');
  expect(db.db.prepare('SELECT COUNT(*) AS n FROM ai_budget_attempts').get()).toMatchObject({n:0});db.close();
});
