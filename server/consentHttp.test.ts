import express from 'express';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import type {Server} from 'node:http';
import {installConsentRoutes,issueConsent} from './consent';
import {CONSENT_VERSION,CONSENT_MAX_AGE_MS} from '../src/services/consent';

describe('consent HTTP boundary',()=>{
  let server:Server,base:string;
  beforeAll(async()=>{
    const app=express();app.use(express.json());installConsentRoutes(app);
    app.post(['/api/calculate','/api/handoff/create-claim'],(_req,res)=>res.json({scope:res.locals.consent.scopes}));
    server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    base=`http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const post=(route:string,body:unknown,cookie='',origin?:string)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json',origin:origin||base,cookie},body:JSON.stringify(body)});
  const acceptance={accepted:true,adult:true,version:CONSENT_VERSION,scope:'core'};
  it('rejects absent/forged/expired receipts regardless of client flags',async()=>{
    for(const cookie of ['', 'zerkalo_consent=confirmed',`zerkalo_consent=${issueConsent('core',null,Date.now()-CONSENT_MAX_AGE_MS-1)}`])
      expect((await post('/api/calculate',{consent:true,ageVerified:true},cookie)).status).toBe(403);
  });
  it('requires affirmative versioned adult action from the same origin',async()=>{
    expect((await post('/api/consent',{...acceptance,accepted:false})).status).toBe(400);
    expect((await post('/api/consent',{...acceptance,adult:false})).status).toBe(400);
    expect((await post('/api/consent',{...acceptance,version:'old'})).status).toBe(400);
    expect((await post('/api/consent',acceptance,'','https://unrelated.invalid')).status).toBe(403);
  });
  it('keeps transfer separately gated and preserves consent across a new request',async()=>{
    expect((await post('/api/consent',{...acceptance,scope:'telegram_transfer'})).status).toBe(403);
    const accepted=await post('/api/consent',acceptance);
    expect(accepted.status).toBe(200);
    const header=accepted.headers.get('set-cookie')!;
    expect(header).toContain('HttpOnly');expect(header).toContain('SameSite=Strict');
    const core=header.split(';')[0];
    const status=await (await fetch(base+'/api/consent',{headers:{cookie:core}})).json();
    expect(status.accepted).toBe(true);expect(status.version).toBe(CONSENT_VERSION);expect(status.recordedAt).toBeTypeOf('number');
    expect((await post('/api/calculate',{},core)).status).toBe(200);
    expect((await post('/api/handoff/create-claim',{consent:true},core)).status).toBe(403);
    const transfer=await post('/api/consent',{...acceptance,scope:'telegram_transfer'},core);
    expect(transfer.status).toBe(200);
    expect((await post('/api/handoff/create-claim',{},transfer.headers.get('set-cookie')!.split(';')[0])).status).toBe(200);
    const cleared=await fetch(base+'/api/consent',{method:'DELETE',headers:{cookie:core}});
    expect(cleared.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');
  });
});
