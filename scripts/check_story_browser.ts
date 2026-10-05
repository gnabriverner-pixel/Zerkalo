import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import express from 'express';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {CommerceStore} from '../server/commerceStore';
import {MockStoryPayment} from '../server/storyPayment';
import {STORY_SAMPLE_MYTH,STORY_SAMPLE_ANSWERS} from '../server/storySample';

// Genuine clean Chrome profiles and UI actions. Synthetic AI/payment dependencies; zero external provider I/O.
process.env.ROUTERAI_API_KEY='';process.env.GOOGLE_API_KEY='';process.env.GEMINI_API_KEY='';
process.env.NODE_ENV='development';process.env.COMMERCE_PAYMENT_MODE='mock';
process.env.LOCAL_STORY_SETUP='true';
const out=path.resolve(process.env.STORY_EVIDENCE_DIR||'output/story-browser');fs.mkdirSync(out,{recursive:true});
const dcsRoot=path.resolve(process.env.DCS_ROOT||'../release-first-sales-dcs-de78');
execFileSync(process.execPath,['scripts/verify_dcs_de78_environment.cjs',dcsRoot],{stdio:'pipe'});
const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'story-browser-'));fs.chmodSync(runtime,0o700);
const temp=express().listen(0,'127.0.0.1');await once(temp,'listening');const dcsPort=(temp.address() as any).port;await new Promise<void>(resolve=>temp.close(()=>resolve()));
process.env.DCS_ROOT=dcsRoot;process.env.PYTHON_BIN=path.join(dcsRoot,'.venv/bin/python');process.env.DCS_BRIDGE_URL=`http://127.0.0.1:${dcsPort}`;
process.env.SHARED_CLAIMS_DIR=path.join(runtime,'claims');process.env.DELETION_SCOPES_FILE=path.join(runtime,'deletion_scopes.json');process.env.DELETION_SCOPES_PATH=process.env.DELETION_SCOPES_FILE;
process.env.DELETION_LOOKUP_SECRET=crypto.randomBytes(32).toString('hex');process.env.CONTINUATION_CLAIM_SECRET=process.env.DELETION_LOOKUP_SECRET;
const dcsLog=fs.openSync(path.join(out,'dcs-browser-runtime.log'),'w',0o600);
const dcs=spawn(process.env.PYTHON_BIN,['-m','integration.dcs_service','--host','127.0.0.1','--port',String(dcsPort)],{cwd:dcsRoot,env:{...process.env,ROUTERAI_API_KEY:''},stdio:['ignore','ignore',dcsLog]});
let server:any,browser:any,activePage:any;let delayedResolve:any;
const traffic:any[]=[],steps:any[]=[],calls:any[]=[];
const mark=(name:string,extra:any={})=>steps.push({name,result:'PASS',...extra});
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const redact=(value:any):any=>Array.isArray(value)?value.map(redact):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,['recovery','token','access','Authorization'].includes(key)?'[REDACTED]':redact(v)])):value;
try{
  for(let i=0;i<50;i++){try{if((await fetch(process.env.DCS_BRIDGE_URL+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const store=new CommerceStore(path.join(runtime,'stories.sqlite'),crypto.randomBytes(32).toString('hex'));
  const {createApp}=await import('../server');
  const application=await createApp({skipVite:true,mythProvider:{name:'synthetic_fixture',model:'no-live-model',isReady:()=>true,generate:async(prompt)=>{
    calls.push({kind:'myth_fixture_transport',prompt_sha256:crypto.createHash('sha256').update(prompt).digest('hex')});
    return JSON.stringify({status:'ok',story_result:STORY_SAMPLE_MYTH});
  }},storyCommerce:{store,payment:new MockStoryPayment(),ready:()=>true,albert:async(body,receipt)=>{
    assert(receipt?.adult===true&&receipt.scopes.includes('core'),'native consent missing');
    assert(body.context?.storyInputs&&body.context?.storyResult,'actual saved source context missing');
    calls.push({kind:'albert_fixture_transport',request:body});
    if(body.message==='Синтетическая задержка для удаления')return new Promise(resolve=>{delayedResolve=resolve;});
    return {status:'ok',response:'Синтетический ответ для технического прохода. Слова человека и предложение ИИ различаются. '+('длиннаястрока'.repeat(30)),provider:'synthetic_fixture',model:null};
  }}});
  application.app.use(express.static(path.resolve('dist')));application.app.get('*',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
  server=application.app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await context.newPage();
  activePage=page;
  const observe=(p:any)=>p.on('response',async(response:any)=>{
    if(!response.url().startsWith(origin+'/api/'))return;
    const req=response.request(),url=new URL(response.url()).pathname;
    let body;try{body=req.postDataJSON();}catch{}
    let output;try{output=await response.json();}catch{}
    traffic.push({path:url,method:req.method(),status:response.status(),input:redact(body),output:redact(output)});
  });observe(page);
  const consent=async(p:any)=>{
    const checkbox=p.getByRole('checkbox',{name:/Мне есть 18|мне есть 18|18 лет/});
    // Match the accepted component's existing human wording, not a seeded consent cookie.
    const dialog=p.getByRole('dialog',{name:'Ваш опыт остаётся вашим',exact:true});
    await dialog.waitFor({state:'visible'});await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button',{name:/Продолжить|Подтвердить|Соглас/}).click();
  };
  const shot=async(p:any,name:string)=>{
    await p.locator('.story-overlay').evaluateAll((elements:any[])=>elements.forEach(e=>{e.scrollTop=0;}));
    await p.screenshot({path:path.join(out,name+'.png'),fullPage:false});
  };
  await page.goto(origin+'/local-story-setup',{waitUntil:'networkidle'});
  assert(await page.getByLabel('Ключ RouterAI для Мифа',{exact:true}).inputValue()==='','setup must not echo credentials');
  await shot(page,'00-local-setup-390');mark('local_configuration_screen_read_only_no_credentials_entered');
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.getByPlaceholder('ДД',{exact:true}).fill('01');await page.getByPlaceholder('ММ',{exact:true}).fill('07');await page.getByPlaceholder('ГГГГ',{exact:true}).fill('1990');
  await page.getByRole('button',{name:'Рассчитать код',exact:true}).click();await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Открыть мой Код',exact:true}).click();await consent(page);
  await page.getByRole('button',{name:'Перейти к Личному мифу',exact:true}).click();
  await page.getByRole('button',{name:'Войти через образы',exact:true}).click();
  const prompts=['В какой ситуации тебе сейчас хочется лучше понять себя?','Какой предмет, место или образ точнее всего передаёт это состояние?','Когда за последнее время ты почувствовал: «вот здесь я на своём месте»?','Чего тебе хочется больше в этой ситуации?'];
  for(let i=0;i<4;i++){
    await page.getByText(prompts[i],{exact:true}).waitFor({state:'visible'});
    await page.waitForTimeout(400); // Wait for the accepted form's page transition, without altering it.
    await page.locator('textarea').first().fill(Object.values(STORY_SAMPLE_ANSWERS)[i]);
    await page.getByRole('button',{name:i===3?'Соткать историю':'Далее',exact:true}).click();
  }
  await page.getByText(STORY_SAMPLE_MYTH.title,{exact:true}).waitFor({state:'visible'});
  mark('clean_profile_native_consent_canonical_code_free_myth',{cookie_preseeded:false,model_transport:'synthetic'});await shot(page,'01-free-myth-390');
  await page.getByRole('button',{name:'Мои истории · 790 ₽',exact:true}).click();
  const library=page.getByRole('dialog',{name:'Новая личная история',exact:true});
  await library.getByRole('checkbox',{name:/Я согласен сохранять мои истории и сообщения на сервере/}).check();await library.getByRole('button',{name:'Включить сохранение историй',exact:true}).click();
  await library.getByRole('button',{name:'Получить код восстановления',exact:true}).click();
  const recovery=await library.locator('code').innerText();assert(recovery.length===43,'recovery capability shape');
  await library.getByRole('checkbox',{name:'Я сохранил код в безопасном месте',exact:true}).check();
  await library.getByRole('button',{name:'Купить новую историю — 790 ₽',exact:true}).click();
  await page.getByRole('button',{name:'Имитировать успешную оплату',exact:true}).click();
  const resumed=page.getByRole('dialog',{name:'Новая личная история',exact:true});
  await resumed.getByRole('button',{name:'Проверить оплату на сервере',exact:true}).click();
  for(const [key,label] of [['q1','В какой ситуации тебе сейчас хочется лучше понять себя?'],['q2','Какой предмет, место или образ точнее всего передаёт это состояние?'],['q3','Когда за последнее время ты почувствовал: «вот здесь я на своём месте»?'],['q4','Чего тебе хочется больше в этой ситуации?']]){
    await resumed.getByLabel(label,{exact:true}).fill(key==='q1'?'Новая ситуация: откладываю письмо о времени разговора.':STORY_SAMPLE_ANSWERS[key as keyof typeof STORY_SAMPLE_ANSWERS]);
  }
  await resumed.getByLabel('Ваш вопрос Альберту (не обязателен)',{exact:true}).fill('Как сообщить о состоянии без обещания готового результата?');
  await resumed.getByRole('button',{name:'Создать новый Миф',exact:true}).click();
  await resumed.getByText('Новая история сохранена. Можно продолжить с Альбертом.',{exact:true}).waitFor();
  mark('mock_payment_server_confirmation_new_answers_new_myth',{money_moved:false});await shot(page,'02-new-paid-test-myth-390');
  for(let i=0;i<5;i++){
    await resumed.getByLabel('Ваше сообщение Альберту',{exact:true}).fill(`Технический вопрос ${i+1} о вымышленном письме.`);
    if(i===0)await page.route('**/api/stories/*/albert',async route=>{
      const reply=await route.fetch();const output=await reply.json();
      traffic.push({path:new URL(route.request().url()).pathname,method:'POST',status:reply.status(),input:redact(route.request().postDataJSON()),output:redact(output),provenance:'fault_injection_received_server_response_before_browser_disconnect'});
      await route.abort('failed');
    },{times:1});
    await resumed.getByRole('button',{name:'Отправить Альберту',exact:true}).click();
    if(i===0){
      await resumed.getByRole('alert').waitFor();const afterLoss=calls.length;
      await resumed.getByRole('button',{name:'Проверить сохранённую историю',exact:true}).click();
      await resumed.getByText('Осталось ответов: 4 из 5. Засчитывается только успешно сохранённый ответ.',{exact:true}).waitFor();
      await resumed.getByRole('button',{name:'Отправить Альберту',exact:true}).click();
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('.story-library label')).find(l=>l.textContent?.includes('Ваше сообщение Альберту'))?.querySelector('textarea')?.value==='');
      assert(calls.length===afterLoss,'lost response replay called generator twice');
      mark('network_loss_after_server_delivery_reopen_and_same_request_replay',{fault:'browser_transport_abort_after_real_synthetic_server_completion',charged_once:true,extra_generator_calls:0});
    }
    await resumed.getByText(`Осталось ответов: ${4-i} из 5. Засчитывается только успешно сохранённый ответ.`,{exact:true}).waitFor();
  }
  assert(await resumed.getByRole('button',{name:'Отправить Альберту',exact:true}).count()===0,'sixth UI reply must be unavailable');
  const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('.story-library,.story-message,.story-library textarea')).some(e=>e.scrollWidth>e.clientWidth+2));assert(!overflow,'390px long-text overflow');
  await resumed.locator('.story-message').last().screenshot({path:path.join(out,'long-message-390.png')});
  mark('five_delivered_replies_no_sixth_action_mobile_longtext',{width:390,synthetic_albert_successes:5});
  await resumed.getByLabel('Ваша заметка — слова человека',{exact:true}).fill('Мои слова: письмо о времени разговора не обещает окончательный результат.');await resumed.getByRole('button',{name:'Сохранить мою заметку',exact:true}).click();
  await page.route('**/api/stories/*/pdf',route=>route.fulfill({status:503,contentType:'application/json',body:'{"status":"error"}'}),{times:1});
  const beforePdfError=calls.length;await resumed.getByRole('button',{name:'Скачать историю PDF',exact:true}).click();
  await resumed.getByText('PDF сейчас недоступен. История остаётся сохранённой.',{exact:true}).waitFor();assert(calls.length===beforePdfError,'PDF error triggered generation');
  mark('PDF_transport_error_keeps_history_without_generation',{fault:'synthetic_HTTP_503_at_browser_transport',renderer_failure_tested:false});
  const download=page.waitForEvent('download');await resumed.getByRole('button',{name:'Скачать историю PDF',exact:true}).click();await(await download).saveAs(path.join(out,'delivered-synthetic-story.pdf'));
  const count=calls.length;await page.reload({waitUntil:'networkidle'});
  await page.getByText('Мои слова: письмо о времени разговора не обещает окончательный результат.',{exact:true}).waitFor();assert(calls.length===count,'reload must not generate');mark('saved_history_pdf_reload_no_generation');await shot(page,'03-five-replies-restored-390');
  const ordersBefore=store.db.prepare("SELECT id,account_id FROM orders WHERE kind='paid'").get() as any;
  fs.writeFileSync(path.join(out,'delivered-synthetic-story.json'),JSON.stringify(store.order(ordersBefore.account_id,ordersBefore.id),null,2));
  const other=await browser.newContext({viewport:{width:390,height:844}}),p=await other.newPage();observe(p);activePage=p;
  await p.goto(origin+'/?stories=1',{waitUntil:'networkidle'});
  const restored=p.getByRole('dialog',{name:'Новая личная история',exact:true});await restored.getByLabel('Код для восстановления',{exact:true}).fill(recovery);await restored.getByRole('button',{name:'Восстановить истории',exact:true}).click();await consent(p);
  await restored.getByText('Истории восстановлены. Никакая генерация не запускалась.',{exact:true}).waitFor();assert(calls.length===count,'recovery must not generate');mark('second_clean_profile_consent_UI_recovery_no_generation');await shot(p,'04-recovery-390');
  await restored.getByRole('button',{name:STORY_SAMPLE_MYTH.title+' · сохранена',exact:true}).last().click();
  await restored.getByLabel('Ваше сообщение Альберту',{exact:true}).fill('Синтетическая задержка для удаления');await restored.getByRole('button',{name:'Отправить Альберту',exact:true}).click();
  for(let i=0;i<50&&!delayedResolve;i++)await new Promise(r=>setTimeout(r,100));assert(delayedResolve,'delayed synthetic transport started');
  await restored.getByRole('checkbox',{name:/Удалить тексты всех сохранённых историй/}).check();await restored.getByRole('button',{name:'Удалить сохранённые истории',exact:true}).click();
  await restored.getByText(/Сохранённые истории и их тексты удалены/).waitFor();delayedResolve({status:'ok',response:'ЗАПОЗДАВШИЙ ТЕКСТ НЕ ДОЛЖЕН ВЕРНУТЬСЯ'});await new Promise(r=>setTimeout(r,250));
  assert((store.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE payload IS NOT NULL AND account_id=?").get(ordersBefore.account_id) as any).n===0,'server personal payload survives deletion');
  await p.reload({waitUntil:'networkidle'});assert(await p.getByText(/ЗАПОЗДАВШИЙ ТЕКСТ/).count()===0,'late text returned after reload');
  await p.getByLabel('Код для восстановления',{exact:true}).fill(recovery);await p.getByRole('button',{name:'Восстановить истории',exact:true}).click();await p.getByText('Код восстановления не найден. Проверьте сохранённый код.',{exact:true}).waitFor();mark('real_server_deletion_late_reply_reopen_recovery_denied');await shot(p,'05-deleted-reopened-390');
  fs.writeFileSync(path.join(out,'deletion-proof.json'),JSON.stringify({transport:'synthetic_ai_mock_payment',server_deleted_payloads:true,deleted_account_id:ordersBefore.account_id,orders:store.db.prepare('SELECT id,state,payload FROM orders WHERE account_id=?').all(ordersBefore.account_id),late_reply_persisted:false,recovery_denied:true},null,2));
  fs.writeFileSync(path.join(out,'events-proof.json'),JSON.stringify({scope:'actual_synthetic_browser_database',events:store.db.prepare('SELECT name,COUNT(*) AS count,MIN(test) AS all_test FROM events GROUP BY name').all(),non_test_events:(store.db.prepare('SELECT COUNT(*) AS n FROM events WHERE test=0').get() as any).n,storage_receipt:store.db.prepare('SELECT storage_accepted,storage_version,storage_accepted_at,deleted FROM accounts WHERE id=?').get(ordersBefore.account_id)},null,2));
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'PASS',scope:'technical_synthetic_browser_only',web_sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dcs_sha:execFileSync('git',['rev-parse','HEAD'],{cwd:dcsRoot,encoding:'utf8'}).trim(),steps,actual_external_provider_attempts:0,synthetic_calls:calls.length,preseeded_cookies:false,preseeded_storage:false},null,2));
  store.close();
}catch(error:any){
  if(activePage){
    const text=(await activePage.locator('body').innerText()).replace(/\b[\w-]{43}\b/g,'[REDACTED]');fs.writeFileSync(path.join(out,'failure-visible-text.txt'),text);
    if(await activePage.locator('.story-library code').count()===0)await activePage.screenshot({path:path.join(out,'failure.png'),fullPage:true});
  }
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'FAIL',error:error.message,steps,actual_external_provider_attempts:0},null,2));throw error;
}finally{
  fs.writeFileSync(path.join(out,'browser-network.json'),JSON.stringify(traffic,null,2));fs.writeFileSync(path.join(out,'synthetic-generator-calls.json'),JSON.stringify(calls,null,2));
  await browser?.close();server?.close();server?.closeAllConnections();dcs.kill('SIGTERM');fs.closeSync(dcsLog);
  // createApp owns background housekeeping timers. This dedicated test process must not remain a service.
  setTimeout(()=>process.exit(process.exitCode||0),1000);
}
