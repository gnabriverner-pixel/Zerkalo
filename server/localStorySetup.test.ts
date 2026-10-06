// @vitest-environment node
import {it,expect,vi} from 'vitest';import express from 'express';import {once} from 'node:events';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {installLocalStorySetup} from './localStorySetup';
it('owner form preserves credentials and requires separate financial approval',async()=>{
 const original={...process.env};const folder=fs.mkdtempSync(path.join(os.tmpdir(),'story-setup-')),filename=path.join(folder,'.env');fs.writeFileSync(filename,'ROUTERAI_API_KEY="synthetic-existing"\nCOMMERCE_SELLER_NAME="synthetic-seller"\n',{mode:0o600});const resolve=path.resolve.bind(path);vi.spyOn(path,'resolve').mockImplementation((...v)=>v.length===1&&v[0]==='.env'?filename:resolve(...v));
 Object.assign(process.env,{LOCAL_STORY_SETUP:'true',COMMERCE_DATA_KEY:'f'.repeat(64),DELETION_LOOKUP_SECRET:'f'.repeat(64),COMMERCE_SELLER_NAME:'synthetic-seller'});delete process.env.COMMERCE_BUDGET_APPROVED;
 const app=express();app.use(express.json());installLocalStorySetup(app);const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;
 const post=(body:any,from=origin)=>fetch(origin+'/api/local-story-setup',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  expect((await post({confirmed:true,financial_confirmed:true})).status).toBe(400);
  const finance={COMMERCE_FREE_BUDGET_RUB:'1050',COMMERCE_FREE_ATTEMPT_MAX:'2',COMMERCE_PAID_BUDGET_RUB:'16700',COMMERCE_PAID_ATTEMPT_MAX:'32',COMMERCE_PAID_ORDER_MAX:'1'};
  expect((await post({confirmed:true,financial_confirmed:true,...finance})).status).toBe(200);expect(process.env.COMMERCE_BUDGET_APPROVED).toBe('true');
  expect((await post({confirmed:true,ROUTERAI_API_KEY:'',COMMERCE_SELLER_NAME:''})).status).toBe(200);expect(fs.readFileSync(filename,'utf8')).toContain('ROUTERAI_API_KEY="synthetic-existing"');expect(fs.readFileSync(filename,'utf8')).toContain('COMMERCE_SELLER_NAME="synthetic-seller"');
  expect((await post({confirmed:true,COMMERCE_FREE_BUDGET_RUB:'1000'})).status).toBe(200);expect(process.env.COMMERCE_BUDGET_APPROVED).toBe('false');
  const before=fs.readFileSync(filename);expect((await post({confirmed:true,ROUTERAI_API_KEY:'foreign'},'https://foreign.invalid')).status).toBe(403);expect(fs.readFileSync(filename).equals(before)).toBe(true);expect(fs.statSync(filename).mode&0o777).toBe(0o600);
 }finally{server.close();server.closeAllConnections();vi.restoreAllMocks();for(const k of Object.keys(process.env))if(!(k in original))delete process.env[k];Object.assign(process.env,original);}
});
