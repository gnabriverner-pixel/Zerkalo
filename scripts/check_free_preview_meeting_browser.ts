// Synthetic browser regression of the shipped UI. Seeded state is intentional only for legacy restore.
import fs from 'node:fs';import path from 'node:path';import express from 'express';import {once} from 'node:events';import {chromium} from 'playwright';
import {STORY_SAMPLE_MYTH,STORY_SAMPLE_ANSWERS} from '../server/storySample';
const out=path.resolve(process.env.STORY_EVIDENCE_DIR||'/tmp/meeting-browser');fs.mkdirSync(out,{recursive:true});
const app=express();app.use(express.static(path.resolve('dist')));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+(server.address() as any).port;
const browser=await chromium.launch({channel:'chrome',headless:true});const results:any[]=[];
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
try{
 for(const phase of ['open','budget_paused','ended','disabled']){
  const active=phase==='open'||phase==='budget_paused',context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(10000);let accepted=false;const posts:string[]=[];
  await page.route('**/api/**',async route=>{const q=route.request(),pathname=new URL(q.url()).pathname;if(q.method()==='POST')posts.push(pathname);
   if(pathname==='/api/consent'){if(q.method()==='POST')accepted=q.postDataJSON().accepted===true;return route.fulfill({json:{accepted,version:'v1.0',scopes:accepted?['core']:[]}});}
   if(pathname==='/api/free-preview')return route.fulfill({json:{enabled:phase!=='disabled',active,phase:active?'open':phase,budget:{paused:phase==='budget_paused'},support_url:'https://t.me/synthetic_help'}});
   return route.fulfill({status:503,json:{status:'error',code:'synthetic_unavailable'}});
  });
  await page.goto(origin,{waitUntil:'networkidle'});await page.waitForTimeout(200);
  assert((await page.getByRole('button',{name:'Встреча',exact:true}).count()===0)===active,'navbar availability '+phase);
  const draft={version:1,updatedAt:new Date().toISOString(),mode:'meeting',codeDate:'01.07.1990',codeResult:{soul:1,path:9,expression:7,direction:8,result:7},firstMirror:{title:'Синтетический Код',keyInsight:'Синтетическое основание'},storyInputs:STORY_SAMPLE_ANSWERS,storyResult:STORY_SAMPLE_MYTH,meetingResult:{summary:'СОХРАНЁННЫЙ ТЕКСТ',confidenceNote:'Синтетика',parallels:[],divergences:[],reflectiveQuestion:'Вопрос?',albertInsight:'Синтетический взгляд'},meetingUserNote:'СОХРАНЁННАЯ ЗАМЕТКА'};
  await page.evaluate(d=>sessionStorage.setItem('zerkalo.transientDraft.v1',JSON.stringify(d)),draft);await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Продолжить',exact:true}).first().click();await page.waitForTimeout(450);
  assert(!posts.includes('/api/meeting-of-mirrors'),'restore automatic Meeting POST '+phase);
  const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('zerkalo.transientDraft.v1')||'{}'));
  assert(stored.meetingUserNote===draft.meetingUserNote&&stored.meetingResult.summary===draft.meetingResult.summary,'saved text lost '+phase);
  if(active){await page.getByRole('status',{name:'Сохранённая Встреча',exact:true}).waitFor();await page.getByText(draft.meetingUserNote,{exact:true}).waitFor();await page.screenshot({path:path.join(out,phase+'-restore.png')});
   await page.getByRole('button',{name:'Продолжить с Альбертом',exact:true}).click();
   await page.getByRole('dialog',{name:'Диалог с Альбертом · ИИ-собеседником',exact:true}).waitFor();assert(!posts.includes('/api/albert'),'opening ordinary Albert generated');await page.screenshot({path:path.join(out,phase+'-albert.png')});
  }else{assert(await page.getByRole('status',{name:'Сохранённая Встреча',exact:true}).count()===0,'ordinary Meeting blocked '+phase);await page.getByRole('heading',{name:'Встреча Зеркал',exact:true}).waitFor();fs.writeFileSync(path.join(out,phase+'-visible.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(out,phase+'-restore.png')});}
  results.push({phase,restored_text_preserved:true,automatic_meeting_posts:0,synthetic_status:true,prepared_legacy_draft:true,posts});await context.close();
 }
 fs.writeFileSync(path.join(out,'meeting-browser-result.json'),JSON.stringify({status:'PASS',external_attempts:0,results},null,2));
}catch(e:any){fs.writeFileSync(path.join(out,'meeting-browser-result.json'),JSON.stringify({status:'FAIL',error:e.message,results},null,2));throw e;}
finally{await browser.close();server.close();server.closeAllConnections();}
