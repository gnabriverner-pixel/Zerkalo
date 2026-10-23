// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';import {once} from 'node:events';
import {CommerceStore} from './commerceStore';import {STORY_SAMPLE_MYTH,STORY_SAMPLE_ANSWERS} from './storySample';
import {CONSENT_VERSION} from '../src/services/consent';
vi.mock('./albert',async original=>({...await original<any>(),generateAlbertDialogue:vi.fn(async()=>({status:'ok',response:'Synthetic ordinary Albert response'}))}));
it('commercial native completion updates only its generator flags; crisis/reopen do not mark Meeting ready',async()=>{
  const store=new CommerceStore(':memory:','e'.repeat(64));const {createApp}=await import('../server');
  const provider={name:'synthetic_fixture',model:'no-live-model',isReady:()=>true,generate:vi.fn(async()=>JSON.stringify({status:'ok',story_result:STORY_SAMPLE_MYTH}))};
  const application=await createApp({skipVite:true,mythProvider:provider,storyCommerce:{store}});
  const server=application.app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${(server.address() as any).port}`;let cookies='';
  const call=async(url:string,body:any)=>{const r=await fetch(origin+url,{method:'POST',headers:{Origin:origin,Cookie:cookies,'Content-Type':'application/json'},body:JSON.stringify(body)});for(const item of r.headers.getSetCookie()){const pair=item.split(';')[0],name=pair.split('=')[0];cookies=cookies.split('; ').filter(x=>!x.startsWith(name+'=')).concat(pair).join('; ');}return {status:r.status,data:await r.json()};};
  try{
    await call('/api/consent',{accepted:true,adult:true,version:CONSENT_VERSION,scope:'core'});
    expect(application.liveGeneration).toEqual({personal_myth:false,meeting:false,albert:false});
    await call('/api/personal-myth',{request_id:'tracking_crisis_001',answers:{...STORY_SAMPLE_ANSWERS,q1:'Я хочу покончить с собой'}});
    const init=await call('/api/personal-myth',{request_id:'tracking_myth_0001',answers:STORY_SAMPLE_ANSWERS});expect(init.status).toBe(202);
    await vi.waitFor(()=>expect(provider.generate).toHaveBeenCalledTimes(1));
    const free=await call('/api/personal-myth',{request_id:'tracking_myth_0001',answers:STORY_SAMPLE_ANSWERS});expect(free.status).toBe(200);expect(free.data.status).toBe('ok');
    expect(application.liveGeneration.personal_myth).toBe(true);expect(application.liveGeneration.albert).toBe(false);
    await call('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'});
    const r=await call(`/api/stories/${free.data.order.id}/albert`,{request_key:'tracking_albert_01',message:'Synthetic ordinary question'});expect(r.data.status).toBe('ok');
    expect(application.liveGeneration).toEqual({personal_myth:true,meeting:false,albert:true});expect(provider.generate).toHaveBeenCalledTimes(1);
  }finally{server.close();server.closeAllConnections();store.close();}
});

// These tests cover the old v1.x path, which is opt-in now (the default writer is v2a).
beforeEach(() => { vi.stubEnv('PERSONAL_MYTH_WRITER', 'legacy'); });
afterEach(() => { vi.unstubAllEnvs(); });
