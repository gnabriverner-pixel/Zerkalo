import {describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {FirstSalesAttemptGuard} from '../scripts/quality/firstSalesAttemptGuard';
import {startFirstSalesProxy} from '../scripts/quality/firstSalesProxy';
describe('one shared first-sales budget, synthetic I/O',()=>{
  const file=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'attempt-guard-')),'attempts.json');
  it('counts concurrent Web/DCS/fallback attempts before I/O and keeps the budget after restart',async()=>{
    const p=file(),g=new FirstSalesAttemptGuard(p),send=vi.fn(async()=>new Response('{"usage":{"prompt_tokens":3}}'));
    await Promise.all(Array.from({length:8},(_,i)=>g.call(JSON.stringify({model:i%2?'fallback':'primary'}),send)));
    await expect(g.call('{}',send)).rejects.toThrow('attempt_budget_exhausted');expect(send).toHaveBeenCalledTimes(8);
    expect(g.snapshot().attempts).toHaveLength(8);g.close();
    const restarted=new FirstSalesAttemptGuard(p);await expect(restarted.call('{}',send)).rejects.toThrow('attempt_budget_exhausted');restarted.close();
  });
  it('reserves before transport and stops after uncertain I/O without inventing usage',async()=>{
    const p=file(),g=new FirstSalesAttemptGuard(p);
    await expect(g.call('{}',async()=>{expect(JSON.parse(fs.readFileSync(p,'utf8')).attempts[0].state).toBe('reserved');throw new Error('synthetic_timeout');})).rejects.toThrow('provider_attempt_uncertain_STOP');
    expect(g.snapshot().attempts[0]).toMatchObject({state:'uncertain',usage:null,status:null});
    const send=vi.fn();await expect(g.call('{}',send)).rejects.toThrow('attempt_guard_STOP');expect(send).not.toHaveBeenCalled();g.close();
    expect(()=>new FirstSalesAttemptGuard(p)).toThrow('attempt_ledger_uncertain_STOP');
  });
  it('refuses a competing process; HTTP failures consume actual attempts',async()=>{
    const p=file(),g=new FirstSalesAttemptGuard(p);expect(()=>new FirstSalesAttemptGuard(p)).toThrow();
    const r=await g.call('{}',async()=>new Response('{"error":"synthetic"}',{status:503}));expect(r.status).toBe(503);expect(g.snapshot().attempts[0]).toMatchObject({number:1,status:503,usage:null});g.close();
  });
  it('Web, DCS and fallback share the actual HTTP gateway; ninth I/O denied and bodies unchanged',async()=>{
    const bodies:string[]=[];const p=file();
    const proxy=await startFirstSalesProxy(p,'synthetic-key',async(_url,init)=>{bodies.push(String(init?.body));expect(JSON.parse(fs.readFileSync(p,'utf8')).attempts).toHaveLength(bodies.length);return Response.json({usage:{prompt_tokens:3,completion_tokens:2,cost:0.01}});});
    try{
      for(let i=0;i<9;i++){
        const body=JSON.stringify({model:i%2?'anthropic/claude-sonnet-5':'deepseek/deepseek-v4.1-flash',messages:[{role:'user',content:'Synthetic Web/DCS probe '+i}],max_tokens:1500});
        const r=await fetch(proxy.origin+'/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer synthetic-key'},body});expect(r.status).toBe(i<8?200:503);if(i<8)expect(bodies[i]).toBe(body);
      }
      expect(bodies).toHaveLength(8);expect(proxy.guard.snapshot().attempts).toHaveLength(8);
    }finally{await proxy.close();}
  });
});
