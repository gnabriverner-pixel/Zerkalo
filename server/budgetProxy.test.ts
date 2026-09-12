// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startBudgetProxy} from '../scripts/quality/routeraiBudgetProxy';
import {PRIMARY_MODEL,FALLBACK_MODEL} from './routerai';

const actualFetch=fetch;
afterEach(()=>vi.unstubAllGlobals());
describe('acceptance budget proxy integration',()=>{
  it('routes only approved bodies and persists exact spend without secrets or prompts',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'routerai-spend-test-'));
    const ledger=path.join(dir,'spend.json');let calls=0;
    vi.stubGlobal('fetch',async(url:any,options:any)=>{
      const s=String(url);
      if(s.startsWith('http://127.0.0.1:'))return actualFetch(url,options);
      if(s.endsWith('/credits'))return new Response(JSON.stringify({data:{credits:1000-calls*0.5}}));
      if(s.endsWith('/endpoints'))return new Response(JSON.stringify({data:{endpoints:[{tag:'deepseek',pricing:{prompt:0.0003,completion:0.0015}}]}}));
      expect(s).toBe('https://routerai.ru/api/v1/chat/completions');calls++;
      return new Response(JSON.stringify({usage:{cost:0.5},choices:[{message:{content:'synthetic-reply'}}]}));
    });
    const proxy=await startBudgetProxy('synthetic-api-secret',ledger);
    try {
      await expect(startBudgetProxy('synthetic-api-secret',path.join(dir,'other.json'))).rejects.toThrow('acceptance_already_locked');
      const body={model:PRIMARY_MODEL,messages:[{role:'user',content:'synthetic-private-text'}],max_tokens:2500,
        include_reasoning:false,reasoning:{effort:'low'},provider:{allow_fallbacks:false}};
      const r=await proxy.transport('ignored',{body:JSON.stringify(body)});
      expect(r.status).toBe(200);expect(proxy.guard.state.chargedRub).toBe(0.5);expect(calls).toBe(1);
      const saved=fs.readFileSync(ledger,'utf8');expect(saved).not.toContain('synthetic-api-secret');expect(saved).not.toContain('synthetic-private-text');
      const invalid=await proxy.transport('ignored',{body:JSON.stringify({...body,model:FALLBACK_MODEL})});
      expect(invalid.status).toBe(402);expect(calls).toBe(1);expect(proxy.guard.state.blocked).toBe(true);
    } finally {await proxy.close();fs.rmSync(dir,{recursive:true});}
  });
  it('no credentials means no metadata or model requests',async()=>{
    const f=vi.fn();vi.stubGlobal('fetch',f);
    await expect(startBudgetProxy('', '/not-used')).rejects.toThrow('routerai_not_ready');expect(f).not.toHaveBeenCalled();
  });
});
