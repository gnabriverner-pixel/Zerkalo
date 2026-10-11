// Synthetic browser path; clean profiles, no real model or payment transport.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import express from 'express';import {spawn,execFileSync} from 'node:child_process';import {once} from 'node:events';import {chromium} from 'playwright';
import {CommerceStore} from '../server/commerceStore';import {FreePreview} from '../server/freePreview';import {AIBudget} from '../server/aiBudget';
import {STORY_SAMPLE_MYTH,STORY_SAMPLE_ANSWERS} from '../server/storySample';
Object.assign(process.env,{ROUTERAI_API_KEY:'',GOOGLE_API_KEY:'',GEMINI_API_KEY:'',TELEGRAM_V2_ALBERT_API_KEY:'',NODE_ENV:'development',COMMERCE_PAYMENT_MODE:'disabled',FREE_PREVIEW_ENABLED:'true',FREE_PREVIEW_SUPPORT_URL:'https://t.me/synthetic_help',COMMERCE_BUDGET_APPROVED:'true',COMMERCE_FREE_BUDGET_RUB:'1000',COMMERCE_FREE_ATTEMPT_MAX:'8'});
const out=path.resolve(process.env.STORY_EVIDENCE_DIR||'output/free-preview-browser');fs.mkdirSync(out,{recursive:true});
const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'free-preview-browser-'));fs.chmodSync(runtime,0o700);
const dcsRoot=path.resolve(process.env.DCS_ROOT||'../release-first-sales-dcs-de78');
const portProbe=express().listen(0,'127.0.0.1');await once(portProbe,'listening');const port=(portProbe.address() as any).port;await new Promise<void>(r=>portProbe.close(()=>r()));
Object.assign(process.env,{DCS_ROOT:dcsRoot,PYTHON_BIN:path.join(dcsRoot,'.venv/bin/python'),DCS_BRIDGE_URL:'http://127.0.0.1:'+port,SHARED_CLAIMS_DIR:path.join(runtime,'claims'),DELETION_SCOPES_FILE:path.join(runtime,'deletions.json'),DELETION_SCOPES_PATH:path.join(runtime,'deletions.json'),DELETION_LOOKUP_SECRET:crypto.randomBytes(32).toString('hex')});
process.env.CONTINUATION_CLAIM_SECRET=process.env.DELETION_LOOKUP_SECRET;
const log=fs.openSync(path.join(out,'dcs-runtime.log'),'w',0o600);
const dcs=spawn(process.env.PYTHON_BIN!,['-m','integration.dcs_service','--host','127.0.0.1','--port',String(port)],{cwd:dcsRoot,env:process.env,stdio:['ignore','ignore',log]});
const nativeFetch=globalThis.fetch;globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(typeof input==='string'?input:input.url||String(input));if(!['127.0.0.1','localhost'].includes(u.hostname))throw Error('external_IO_forbidden_in_synthetic_browser');return nativeFetch(input,init);}) as typeof fetch;
const store=new CommerceStore(path.join(runtime,'stories.sqlite'),crypto.randomBytes(32).toString('hex'));
const steps:any[]=[],traffic:any[]=[],calls:any[]=[];let server:any,browser:any,page:any,delayed:any;
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
const mark=(name:string,detail:any={})=>steps.push({name,result:'PASS',...detail});
const redact=(v:any):any=>Array.isArray(v)?v.map(redact):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,/recovery|token|access|authorization/i.test(k)?'[REDACTED]':redact(x)])):v;
try{
  new AIBudget(()=>store,process.env).db();new FreePreview(()=>store,process.env).activate();
  for(let i=0;i<60;i++){try{if((await fetch(process.env.DCS_BRIDGE_URL+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const {createApp}=await import('../server');
  const app=await createApp({skipVite:true,mythProvider:{name:'synthetic_fixture',model:'no-live-model',isReady:()=>true,generate:async(prompt)=>{calls.push({kind:'myth',prompt_sha256:crypto.createHash('sha256').update(prompt).digest('hex')});return JSON.stringify({status:'ok',story_result:STORY_SAMPLE_MYTH});}},storyCommerce:{store,ready:()=>true,albert:async(body,receipt)=>{
    assert(receipt?.adult&&receipt.scopes.includes('core'),'native consent missing');assert(body.context?.storyInputs&&body.context?.storyResult,'saved story context missing');
    calls.push({kind:'albert',message:body.message});
    if(body.message==='Синтетическая задержка для удаления')return new Promise(r=>{delayed=r;});
    if(body.message==='Синтетическая ошибка')throw Error('synthetic_transport_failure');
    return {status:'ok',response:'Синтетический ответ. Можно сообщить состояние письма, не обещая окончательного результата. '+('длиннаястрока'.repeat(25)),provider:'synthetic_fixture',model:null};
  }}});
  app.app.use(express.static(path.resolve('dist')));app.app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
  server=app.app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});page=await context.newPage();
  const observe=(p:any)=>p.on('response',async(r:any)=>{if(!r.url().startsWith(origin+'/api/'))return;const req=r.request();let input,output;try{input=req.postDataJSON();}catch{}try{output=await r.json();}catch{}traffic.push({path:new URL(r.url()).pathname,method:req.method(),status:r.status(),input:redact(input),output:redact(output)});});
  observe(page);
  const consent=async(p:any)=>{const d=p.getByRole('dialog',{name:'Ваш опыт остаётся вашим',exact:true});await d.waitFor();await d.getByRole('checkbox').check();await d.getByRole('button',{name:/Продолжить|Подтвердить|Соглас/}).click();};
  const shot=async(p:any,name:string)=>{await p.locator('.story-overlay').evaluateAll((es:any[])=>es.forEach(e=>e.scrollTop=0));await p.screenshot({path:path.join(out,name+'.png'),fullPage:false,mask:[p.locator('.story-library code')]});};
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.getByPlaceholder('ДД',{exact:true}).fill('01');await page.getByPlaceholder('ММ',{exact:true}).fill('07');await page.getByPlaceholder('ГГГГ',{exact:true}).fill('1990');
  await page.getByRole('button',{name:'Посмотреть описание',exact:true}).click();await page.waitForTimeout(500);await page.getByRole('button',{name:'Открыть мой Код',exact:true}).click();await consent(page);
  await page.getByRole('button',{name:'Перейти к Личному мифу',exact:true}).click();await page.getByRole('button',{name:'Создать мою историю',exact:true}).click();
  const prompts=['В какой ситуации тебе сейчас хочется лучше понять себя?','Какой предмет, место или образ точнее всего передаёт это состояние?','Когда за последнее время ты почувствовал: «вот здесь я на своём месте»?','Чего тебе хочется больше в этой ситуации?'];
  for(let i=0;i<4;i++){await page.getByText(prompts[i],{exact:true}).waitFor();await page.waitForTimeout(400);await page.locator('textarea').first().fill(Object.values(STORY_SAMPLE_ANSWERS)[i]);await page.getByRole('button',{name:i===3?'Соткать историю':'Далее',exact:true}).click();}
  await page.getByText(STORY_SAMPLE_MYTH.title,{exact:true}).waitFor();mark('clean_profile_UI_consent_Code_one_Myth',{prepared_cookies:false,prepared_storage:false});await shot(page,'01-myth-mobile');
  await page.getByRole('button',{name:'Обсудить с Альбертом и сохранить',exact:true}).click();
  const lib=page.getByRole('dialog',{name:'Новая личная история',exact:true});
  await lib.getByRole('checkbox',{name:/Я согласен сохранять мои истории и сообщения на сервере/}).check();await lib.getByRole('button',{name:'Включить сохранение историй',exact:true}).click();
  await lib.getByRole('button',{name:STORY_SAMPLE_MYTH.title+' · сохранена',exact:true}).waitFor();
  assert(await lib.getByRole('button',{name:/Купить/}).count()===0,'payment action exposed');mark('free_direct_Albert_without_Meeting_storage_consent');await shot(page,'02-archive-mobile');
  await lib.getByLabel('Ваше сообщение Альберту',{exact:true}).fill('Синтетическая ошибка');await lib.getByRole('button',{name:'Отправить Альберту',exact:true}).click();await lib.getByRole('alert').waitFor();assert((store.db.prepare("SELECT COUNT(*) AS n FROM operations WHERE kind='albert' AND charged=1").get() as any).n===0,'failure consumed successful allowance');mark('failed_reply_preserves_input_and_allowance');
  assert(await lib.getByLabel('Ваше сообщение Альберту').inputValue()==='Синтетическая ошибка','failed input lost');await lib.getByLabel('Ваше сообщение Альберту').fill('Синтетическая задержка для удаления');await lib.getByRole('button',{name:'Отправить Альберту',exact:true}).click();
  for(let i=0;i<50&&!delayed;i++)await new Promise(r=>setTimeout(r,100));assert(delayed,'pending fixture not started');
  const original=store.db.prepare('SELECT id,account_id FROM orders').get() as any;
  await lib.getByRole('checkbox',{name:/Удалить тексты всех сохранённых историй/}).check();await lib.getByRole('button',{name:'Удалить сохранённые истории',exact:true}).click();await lib.getByText(/Сохранённые истории и их тексты удалены/).waitFor();
  delayed({status:'ok',response:'ЗАПОЗДАВШИЙ ТЕКСТ'});await page.waitForTimeout(300);await page.reload({waitUntil:'networkidle'});
  assert((store.db.prepare('SELECT COUNT(*) AS n FROM orders WHERE account_id=? AND payload IS NOT NULL').get(original.account_id) as any).n===0,'server payload survived');assert(await page.getByText(/ЗАПОЗДАВШИЙ ТЕКСТ/).count()===0,'late reply returned');mark('UI_general_archive_deletion_pending_late_reply_and_reopen');await shot(page,'03-deleted-mobile');
  // A separate clean synthetic access checks the finite allowance and recovery; no attempt to identify physical people.
  const other=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});const p=await other.newPage();page=p;observe(p);await p.goto(origin,{waitUntil:'networkidle'});
  await p.getByPlaceholder('ДД',{exact:true}).fill('01');await p.getByPlaceholder('ММ',{exact:true}).fill('07');await p.getByPlaceholder('ГГГГ',{exact:true}).fill('1990');await p.getByRole('button',{name:'Посмотреть описание',exact:true}).click();await p.waitForTimeout(500);await p.getByRole('button',{name:'Открыть мой Код',exact:true}).click();await consent(p);await p.getByRole('button',{name:'Перейти к Личному мифу',exact:true}).click();await p.getByRole('button',{name:'Создать мою историю',exact:true}).click();
  for(let i=0;i<4;i++){await p.getByText(prompts[i],{exact:true}).waitFor();await p.waitForTimeout(400);await p.locator('textarea').first().fill(Object.values(STORY_SAMPLE_ANSWERS)[i]);await p.getByRole('button',{name:i===3?'Соткать историю':'Далее',exact:true}).click();}
  await p.getByRole('button',{name:'Обсудить с Альбертом и сохранить',exact:true}).click();
  const l=p.getByRole('dialog',{name:'Новая личная история',exact:true});await l.getByRole('checkbox',{name:/Я согласен сохранять мои истории и сообщения на сервере/}).check();await l.getByRole('button',{name:'Включить сохранение историй',exact:true}).click();await l.getByRole('button',{name:STORY_SAMPLE_MYTH.title+' · сохранена',exact:true}).waitFor();
  for(let i=0;i<5;i++){await l.getByLabel('Ваше сообщение Альберту').fill('Технический вопрос '+(i+1));await l.getByRole('button',{name:'Отправить Альберту',exact:true}).click();await l.getByText('Осталось ответов: '+(4-i)+' из 5. Засчитывается только успешно сохранённый ответ.',{exact:true}).waitFor();}
  assert(await l.getByRole('button',{name:'Отправить Альберту',exact:true}).count()===0,'sixth reply button remains');
  assert(!(await p.evaluate(()=>Array.from(document.querySelectorAll('.story-library,.story-message,.story-library textarea')).some(e=>e.scrollWidth>e.clientWidth+2))),'mobile overflow');mark('five_delivered_replies_no_sixth_mobile_390');await shot(p,'04-five-replies-mobile');
  await l.getByLabel('Ваша заметка — слова человека',{exact:true}).fill('Моя заметка: можно сообщить промежуточное состояние.');await l.getByRole('button',{name:'Сохранить мою заметку',exact:true}).click();
  await l.getByRole('checkbox',{name:/Согласен сохранить этот отзыв отдельно/}).check();await l.getByRole('textbox',{name:/Что конкретно стало яснее/}).fill('Синтетический отзыв: яснее промежуточное сообщение.');await l.getByRole('button',{name:'Сохранить отзыв',exact:true}).click();await l.getByText(/Отзыв сохранён/).waitFor();
  await l.getByRole('button',{name:'Сообщить о проблеме',exact:true}).click();mark('separate_optional_feedback_and_support_queue');
  const download=p.waitForEvent('download');await l.getByRole('button',{name:'Скачать историю PDF',exact:true}).click();await(await download).saveAs(path.join(out,'synthetic-story.pdf'));
  await l.getByRole('button',{name:'Получить код восстановления',exact:true}).click();const recovery=await l.locator('code').innerText();assert(recovery.length===43,'bad recovery');
  const before=calls.length;await p.reload({waitUntil:'networkidle'});await p.getByRole('button',{name:'Мои истории · бесплатно',exact:true}).click();await p.getByText('Моя заметка: можно сообщить промежуточное состояние.',{exact:true}).waitFor();assert(calls.length===before,'reload generated');
  const third=await browser.newContext({viewport:{width:390,height:844}}),r=await third.newPage();page=r;observe(r);await r.goto(origin+'/?stories=1',{waitUntil:'networkidle'});
  await r.getByLabel('Код для восстановления',{exact:true}).fill(recovery);await r.getByRole('button',{name:'Восстановить истории',exact:true}).click();await consent(r);await r.getByText('Истории восстановлены. Никакая генерация не запускалась.',{exact:true}).waitFor();assert(calls.length===before,'restore generated');mark('PDF_actual_download_reload_clean_profile_recovery');await shot(r,'05-restored-mobile');
  fs.writeFileSync(path.join(out,'primary-state.json'),JSON.stringify({general_deletion:{account:original.account_id,orders:store.db.prepare('SELECT id,state,payload FROM orders WHERE account_id=?').all(original.account_id)},events:store.db.prepare('SELECT name,COUNT(*) AS count FROM events GROUP BY name').all(),operations:store.db.prepare('SELECT kind,state,charged,COUNT(*) AS count FROM operations GROUP BY kind,state,charged').all(),feedback_rows:(store.db.prepare('SELECT COUNT(*) AS n FROM preview_feedback').get() as any).n,support_queue:store.db.prepare('SELECT order_id,reason FROM support_requests').all()},null,2));
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'PASS',scope:'synthetic_browser_only',web_sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dcs_sha:execFileSync('git',['rev-parse','HEAD'],{cwd:dcsRoot,encoding:'utf8'}).trim(),steps,actual_external_provider_attempts:0,synthetic_calls:calls.length,prepared_cookies:false,prepared_storage:false},null,2));
}catch(e:any){fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'FAIL',error:e.message,steps,actual_external_provider_attempts:0},null,2));if(page){fs.writeFileSync(path.join(out,'failure-visible-text.txt'),(await page.locator('body').innerText()).replace(/\b[\w-]{43}\b/g,'[REDACTED]'));await page.screenshot({path:path.join(out,'failure.png'),fullPage:true,mask:[page.locator('.story-library code')]});}throw e;
}finally{fs.writeFileSync(path.join(out,'browser-network.json'),JSON.stringify(traffic,null,2));fs.writeFileSync(path.join(out,'synthetic-calls.json'),JSON.stringify(calls,null,2));await browser?.close();server?.close();server?.closeAllConnections();store.close();dcs.kill('SIGTERM');fs.closeSync(log);setTimeout(()=>process.exit(process.exitCode||0),500);}
