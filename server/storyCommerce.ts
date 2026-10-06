import type {Express,Request,Response} from 'express';
import path from 'node:path';
import {CommerceStore,CommerceError,type StoryOrder} from './commerceStore';
import {MockStoryPayment,YooTestPayment,liveCheckoutConfigured,validReceiptEmail,type StoryPayment} from './storyPayment';
import {makeStoryPdf,storySections} from './storyPdf';
import {STORY_SAMPLE} from './storySample';
import {verifyConsent} from './consent';
import {parsePersonalMythRequest,parsePersonalMythResult,containsCrisisLanguage,SAFE_CRISIS_MESSAGE} from './myth';
import {parseAlbertMessage,checkSafety} from './albert';
import {checkAndIncrementRate,consumeDailyBudget} from './rateLimit';
import {AIBudget,withAIBudget} from './aiBudget';
import {FreePreview,PREVIEW_FEEDBACK_VERSION} from './freePreview';

const COOKIE='zerkalo_stories';
const cookie=(req:Request,name:string)=>(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const local=(req:Request)=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'') && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.get('host')||'');
const sameOrigin=(req:Request)=>{try{return new URL(req.get('origin')||'').host===req.get('host');}catch{return false;}};
const key=(value:unknown)=>{if(typeof value!=='string'||!/^[\w-]{8,100}$/.test(value))throw new CommerceError('request_key_required',400);return value;};
function publicOrder(order:StoryOrder){
  return {id:order.id,kind:order.kind,state:order.state,test:Boolean(order.test),created_at:order.created_at,
    remaining:order.remaining,pending:order.pending,data:order.data,checkout_url:order.checkout_url,preview_temporary:order.preview_temporary};
}
export interface StoryCommerceOptions {
  store?:CommerceStore; payment?:StoryPayment;
  myth:(body:any)=>Promise<any>;
  albert:(body:any,consent:any)=>Promise<any>;
  ready:()=>boolean;
}

export function installStoryCommerce(app:Express,options:StoryCommerceOptions){
  let database=options.store;
  const enabled=()=>Boolean(options.store)||process.env.COMMERCE_ENABLED==='true'||process.env.FREE_PREVIEW_ENABLED==='true';
  const store=()=>{
    if(!enabled())throw new CommerceError('commerce_disabled',503);
    if(!database)database=new CommerceStore(path.resolve(process.env.COMMERCE_DB_PATH||'data/commerce/stories.sqlite'),process.env.COMMERCE_DATA_KEY||'');
    return database;
  };
  let mock:MockStoryPayment|undefined;
  const payment=():StoryPayment=>{
    if(process.env.FREE_PREVIEW_ENABLED==='true')throw new CommerceError('preview_payment_disabled',503);
    if(options.payment)return options.payment;
    if(process.env.COMMERCE_PAYMENT_MODE==='test')return new YooTestPayment(process.env);
    if(process.env.COMMERCE_PAYMENT_MODE==='live'&&liveCheckoutConfigured(process.env))return new YooTestPayment(process.env,fetch,'live');
    if(process.env.COMMERCE_PAYMENT_MODE==='mock' && process.env.NODE_ENV!=='production')return mock ||= new MockStoryPayment();
    throw new CommerceError('checkout_not_connected',503);
  };
  const account=(req:Request)=>{const id=store().account(cookie(req,COOKIE));if(!id)throw new CommerceError('account_required',401);return id;};
  const budget=new AIBudget(store,process.env);
  const preview=new FreePreview(store,process.env);
  const availability=()=>{const state=preview.status(),funds=budget.freeAvailability();return {...state,
    can_start_myth:!state.enabled||Boolean(options.ready()&&funds.available&&state.phase!=='not_started'),
    new_generation_available:Boolean(state.active&&options.ready()&&funds.available),budget_warning:funds.warning,
    pause_message:!options.ready()?'Истории временно недоступны. Полученные результаты сохранены.':!funds.available?'Новые генерации временно приостановлены: общий бюджет пробного доступа недоступен. Полученные истории и PDF остаются доступны.':state.phase==='not_started'?'Пробный доступ ещё не открыт.':state.active?'':'Пятидневный пробный доступ завершён. Сохранённые результаты доступны.'};};
  const setAccess=(res:Response,access:string)=>res.cookie(COOKIE,access,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'||process.env.COMMERCE_PUBLIC_ORIGIN?.startsWith('https://'),path:'/',maxAge:365*86400000});
  const errors:Record<string,string>={
    checkout_not_connected:'Оплата ещё не подключена. Ваш бесплатный результат доступен.',
    commerce_key_missing:'Сохранение историй ещё не настроено. Ответы остаются в форме.',
    recovery_invalid:'Код восстановления не найден. Проверьте сохранённый код.',
    new_answers_required:'Для новой истории нужны новые ответы. Предыдущая история уже сохранена.',
    albert_limit:'Пять ответов этого заказа уже выданы. История и PDF остаются доступны.',
    complete_free_first:'Сначала завершите первую бесплатную историю.',
    delivery_needs_support:'Лимит безопасных попыток исчерпан. Сохраните номер заказа и обратитесь в поддержку для выдачи или возврата.',
    account_deleted:'Эта история удалена. Запоздавший ответ не сохранён.',
    operation_in_progress:'Запрос уже выполняется или его результат неизвестен. Проверьте сохранённую историю.',
    new_sales_paused:'Новые покупки временно приостановлены до восстановления резерва выдачи. Ваши сохранённые результаты доступны.',
    paid_service_waiting:'Выдача оплаченного заказа ожидает восстановления резерва. Сохраните номер заказа и обратитесь в поддержку.',
    ai_budget_unconfigured:'Финансовый предел запуска ещё не утверждён. Сохранённые результаты доступны.',
    free_budget_exhausted:'Лимит бесплатных обращений достигнут. Сохранённые результаты остаются доступны.',
    dcs_budget_not_covered:'Сервис диалога ожидает безопасного запуска. Для оплаченного заказа сохраните его номер и обратитесь в поддержку.',
    ai_budget_recovery_waiting:'После восстановления требуется проверка финансового журнала. Заказ сохранён; обратитесь в поддержку.',
    ai_tariffs_stale:'Сервис временно приостановлен: стоимость вызова не подтверждена. Ваш заказ и сохранённые результаты доступны; поддержка видит причину остановки.',
    preview_ended:'Пятидневный пробный доступ завершён. Уже полученные истории и PDF доступны.',
    service_busy:'Сейчас выполняются другие запросы. Ввод сохранён — попробуйте через минуту.',
    free_story_already_issued:'В этом доступе история уже создана. Откройте сохранённую историю или восстановите доступ своим кодом.',
  };
  const route=(fn:(req:Request,res:Response)=>Promise<any>|any)=>(req:Request,res:Response)=>{
    Promise.resolve().then(()=>fn(req,res)).catch(error=>{
      const known=error instanceof CommerceError,code=known?error.code:'story_delivery_failed';
      // Never log provider bodies, customer texts, keys or a raw stack containing them.
      res.status(known?error.status:502).json({status:'error',code,operation_failed:error?.operation_failed===true,ui:{safe_message:errors[code]||'Не удалось завершить действие. Ваш ввод остаётся в форме; проверьте историю перед повтором.'}});
    });
  };
  const buckets=new Map();
  app.get('/api/free-preview',(_req,res)=>res.set('Cache-Control','no-store').json(availability()));
  app.get('/api/local-free-preview',route((req,res)=>{
    if(!local(req)||process.env.LOCAL_STORY_SETUP!=='true'||process.env.NODE_ENV==='production')return res.sendStatus(404);
    res.json({...preview.aggregate(),availability:availability()});
  }));
  app.get('/local-story-support',(req,res)=>{
    if(!local(req)||process.env.LOCAL_STORY_SETUP!=='true'||process.env.NODE_ENV==='production')return res.sendStatus(404);
    res.set('Cache-Control','no-store').type('html').send(`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Обращения по историям</title><h1>Локальный оператор</h1><p>Найдите оплаченный невыданный заказ или заявку на возврат. Сначала сверьте платеж. Освобождение прерванного запроса позволяет человеку явно повторить действие, но само не генерирует ответ и не возвращает финансовый резерв. Возврат денег выполняется в кабинете магазина; его подтверждение должно отозвать доступ.</p><button onclick="location.reload()">Обновить очередь</button><pre id="queue"></pre><form id="operator"><label>Номер заказа<input name="order_id" required></label><select name="action"><option value="verify_payment">Сверить платёж через API</option><option value="acknowledge_interrupted">Разрешить явный повтор прерванного запроса</option><option value="request_refund">Записать заявку на возврат</option></select><label><input id="confirmed" type="checkbox"> Подтверждаю разрешение явного повтора</label><button>Выполнить</button></form><p id="result"></p><script>fetch('/api/local-story-support').then(r=>r.json()).then(d=>document.getElementById('queue').textContent=JSON.stringify(d,null,2));document.getElementById('operator').onsubmit=async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));values.confirmed=document.getElementById('confirmed').checked;const r=await fetch('/api/local-story-support/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});document.getElementById('result').textContent=JSON.stringify(await r.json());};</script></html>`);
  });
  app.get('/api/local-story-support',route((req,res)=>{
    if(!local(req)||process.env.LOCAL_STORY_SETUP!=='true'||process.env.NODE_ENV==='production')return res.sendStatus(404);
    res.json({recipient:'local_owner_operator',requests:store().db.prepare("SELECT o.id AS order_id,s.reason,COALESCE(s.created_at,o.created_at) AS created_at,o.test,o.state,o.payment_id FROM orders o LEFT JOIN support_requests s ON o.id=s.order_id WHERE (s.order_id IS NOT NULL OR (o.kind='paid' AND o.state IN ('paid','answers_saved','generating','generation_failed'))) ORDER BY created_at DESC LIMIT 100").all(),budget:store().budgetSummary(),actions:['verify_payment','acknowledge_interrupted','request_refund']});
  }));
  app.post('/api/local-story-support/action',route(async(req,res)=>{
    if(!local(req)||process.env.LOCAL_STORY_SETUP!=='true'||process.env.NODE_ENV==='production')return res.sendStatus(404);
    if(!sameOrigin(req))throw new CommerceError('origin_rejected',403);
    const db=store(),row=db.db.prepare("SELECT id,account_id,payment_id FROM orders WHERE id=? AND kind='paid'").get(String(req.body?.order_id||'')) as any;
    if(!row)throw new CommerceError('story_not_found',404);
    if(req.body?.action==='verify_payment'){
      if(!row.payment_id)throw new CommerceError('payment_not_created');
      db.confirmPayment(row.account_id,row.id,await payment().get(row.payment_id));
    }else if(req.body?.action==='acknowledge_interrupted'){
      if(req.body?.confirmed!==true)throw new CommerceError('explicit_retry_required',400);
      db.acknowledgeUncertain(row.account_id,row.id);
    }else if(req.body?.action==='request_refund')db.support(row.account_id,row.id,'refund');
    else throw new CommerceError('operator_action_invalid',400);
    res.json({recorded:true,order_id:row.id,action:req.body.action,money_moved:false});
  }));
  app.get('/api/stories-sample',(_req,res)=>res.json({synthetic:true,provenance:'historical_test_fixture_and_prepared_dialogue',sections:storySections(STORY_SAMPLE)}));
  app.get('/api/stories-sample/pdf',(_req,res)=>res.set('Content-Disposition','attachment; filename="synthetic-story-sample.pdf"').type('application/pdf').send(makeStoryPdf(STORY_SAMPLE)));
  app.get('/api/stories/status',async(req,res)=>{
    // Reopen an existing archive after restart without creating accounts or requesting consent here.
    if(!database&&enabled()&&cookie(req,COOKIE)){try{store();}catch{/* Configuration is reported by the local setup screen. */}}
    const id=database?.account(cookie(req,COOKIE));
    const configuredMode=preview.enabled()?'disabled':options.payment?.mode||process.env.COMMERCE_PAYMENT_MODE||'disabled';
    if(configuredMode==='live'&&budget.configured()){try{await budget.prepare();}catch{/* Rights remain available; capacity reports the pause. */}}
    const live=liveCheckoutConfigured(process.env)&&budget.capacity();
    res.set('Cache-Control','no-store').json({enabled:enabled(),storage_accepted:Boolean(id&&database?.storageAccepted(id)),payment_mode:configuredMode==='live'&&!liveCheckoutConfigured(process.env)?'disabled':configuredMode,live_checkout:!preview.enabled()&&live,new_sales_paused:configuredMode==='live'&&!live,title:'Новая личная история',price_rub:790,support_email:process.env.COMMERCE_SUPPORT_EMAIL||null,preview:availability()});
  });
  // A forged notification cannot issue rights. Retrieve the object under the merchant's credentials.
  app.post('/api/stories/payment-webhook',route(async(req,res)=>{
    if(!enabled())throw new CommerceError('commerce_disabled',503);
    if(!checkAndIncrementRate(req.ip||'unknown',20,Date.now(),60000,buckets).allowed)throw new CommerceError('rate_limit',429);
    const adapter=payment(),notification=req.body;
    if(adapter.mode==='mock')throw new CommerceError('mock_notifications_disabled',403);
    const id=String(notification?.object?.id||'');
    if(notification?.event==='refund.succeeded'){
      if(!adapter.refund)throw new CommerceError('refund_not_supported',503);
      const refund=await adapter.refund(id),found=store().paymentOrder(refund.payment_id);
      if(found && refund.status==='succeeded' && refund.amount?.value==='790.00' && refund.amount?.currency==='RUB')store().markRefunded(found.account,found.id);
    }else if(['payment.succeeded','payment.canceled'].includes(notification?.event)){
      const actual=await adapter.get(id),found=store().paymentOrder(actual.id);
      if(found)store().confirmPayment(found.account,found.id,actual);
      // Unknown payment is never associated by an untrusted order_id from the notification.
    }else throw new CommerceError('notification_invalid',400);
    res.json({received:true});
  }));
  app.use('/api/stories',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    const consent=verifyConsent(cookie(req,'zerkalo_consent')||'');
    if(!consent)return res.status(403).json({status:'error',code:'consent_required'});
    if(req.method!=='GET'&&!sameOrigin(req))return res.status(403).json({code:'origin_rejected'});
    res.locals.consent=consent;next();
  });
  app.post('/api/stories/account',route((req,res)=>{
    const previous=store().account(cookie(req,COOKIE));
    const accepted=req.body?.storage_accepted===true&&req.body?.storage_version==='personal-history-storage-v1';
    if(previous){if(accepted)store().acceptStorage(previous);if(!store().storageAccepted(previous))throw new CommerceError('storage_consent_required',403);return res.json({created:false});}
    if(!accepted)throw new CommerceError('storage_consent_required',403);
    if(!checkAndIncrementRate('account:'+req.ip,10,Date.now(),600000,buckets).allowed)throw new CommerceError('account_rate_limit',429);
    const created=store().createAccount(true);setAccess(res,created.access);res.json({created:true,recovery:created.recovery});
  }));
  app.post('/api/stories/restore',route((req,res)=>{
    if(!checkAndIncrementRate('restore:'+req.ip,5,Date.now(),600000,buckets).allowed)throw new CommerceError('recovery_rate_limit',429);
    const restored=store().restore(String(req.body?.recovery||'').trim());setAccess(res,restored.access);res.json({restored:true});
  }));
  app.post('/api/stories/recovery',route((req,res)=>res.json({recovery:store().recovery(account(req))})));
  app.post('/api/stories/import-free',route((req,res)=>{
    const answers=parsePersonalMythRequest({request_id:'legacy_import_0001',answers:req.body?.answers}).answers;
    const myth=parsePersonalMythResult(JSON.stringify(req.body?.myth));
    if(!myth.title||!myth.story||myth.story.length>16000)throw new CommerceError('legacy_myth_invalid',400);
    const order=store().importFree(account(req),answers,myth);if(preview.status().active&&order.created_at>=preview.status().started_at!)preview.mark(order.id);
    res.json({order:publicOrder(store().order(account(req),order.id))});
  }));
  app.get('/api/stories',route((req,res)=>res.json({orders:store().list(account(req)).map(publicOrder)})));
  app.get('/api/stories/:id',route((req,res)=>res.json({order:publicOrder(store().order(account(req),req.params.id))})));
  app.post('/api/stories/offer',route((req,res)=>{
    const free=store().list(account(req)).find(order=>order.kind==='free'&&order.state==='ready');
    if(free)store().event('offer_shown',free);res.json({recorded:Boolean(free)});
  }));
  app.post('/api/stories/orders',route(async(req,res)=>{
    const adapter=payment();
    if(adapter.mode==='mock'&&!local(req))throw new CommerceError('mock_local_only',403);
    if(adapter.mode==='live')await budget.prepare();
    if(adapter.mode==='live'&&!budget.capacity())throw new CommerceError('new_sales_paused',503);
    if(adapter.mode==='live')await budget.dcsHeaders(process.env.DCS_BRIDGE_URL||'http://127.0.0.1:39500');
    res.json({order:publicOrder(store().createOrder(account(req),key(req.body?.request_key),'paid',adapter.mode!=='live'))});
  }));
  app.post('/api/stories/:id/checkout',route(async(req,res)=>{
    const id=account(req),db=store(),adapter=payment();
    if(adapter.mode==='mock'&&!local(req))throw new CommerceError('mock_local_only',403);
    let order=db.order(id,req.params.id);
    if(order.checkout_url)return res.json({url:order.checkout_url});
    if(adapter.mode==='live'){
      await budget.dcsHeaders(process.env.DCS_BRIDGE_URL||'http://127.0.0.1:39500');
      budget.hold(id,order.id); // Persistent obligation reserved before any payment POST.
      const email=String(req.body?.receipt_email||order.data?.receipt_email||'').trim();
      if(!validReceiptEmail(email))throw new CommerceError('receipt_email_required',400);
      db.receiptContact(id,order.id,email);order=db.order(id,order.id);
    }
    db.paymentStarted(id,order.id);order=db.order(id,order.id);
    const actual=await adapter.create(order);
    if(!actual.id||actual.amount?.value!=='790.00'||actual.amount?.currency!=='RUB'||actual.metadata?.order_id!==order.id||actual.test!==Boolean(order.test))throw new CommerceError('payment_mismatch',422);
    const terminal=['succeeded','canceled'].includes(actual.status);
    const url=terminal?'/?stories=1':actual.confirmation?.confirmation_url;
    if(!url)throw new CommerceError('payment_mismatch',422);
    if(['test','live'].includes(adapter.mode) && !terminal && !(new URL(url).protocol==='https:' && /(^|\.)yoomoney\.ru$/.test(new URL(url).hostname)))throw new CommerceError('payment_url_invalid',422);
    db.attachPayment(id,order.id,actual.id,url);res.json({url});
  }));
  app.post('/api/stories/:id/payment-refresh',route(async(req,res)=>{
    const id=account(req),db=store(),order=db.order(id,req.params.id);
    if(!order.payment_id)throw new CommerceError('payment_not_created');
    if(!checkAndIncrementRate('payment:'+id,12,Date.now(),60000,buckets).allowed)throw new CommerceError('payment_refresh_rate_limit',429);
    const actual=await payment().get(order.payment_id);
    res.json({order:publicOrder(db.confirmPayment(id,order.id,actual))});
  }));
  app.get('/api/stories/mock-checkout/:payment',route((req,res)=>{
    const adapter=payment();if(!(adapter instanceof MockStoryPayment)||!local(req))throw new CommerceError('mock_local_only',403);
    const found=store().paymentOrder(req.params.payment);
    if(!found||found.account!==account(req))throw new CommerceError('story_not_found',404);
    // POST form is deliberate and same-origin. This simulation cannot be enabled in production.
    res.type('html').send(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Имитация оплаты</title><body><h1>Имитация оплаты — деньги не списываются</h1><p>Новая личная история · 790 ₽</p><form method="post"><button name="decision" value="success">Имитировать успешную оплату</button><button name="decision" value="cancel">Имитировать отмену</button></form></body></html>`);
  }));
  // Express urlencoded is installed by the caller before these routes.
  app.post('/api/stories/mock-checkout/:payment',route((req,res)=>{
    const adapter=payment();if(!(adapter instanceof MockStoryPayment)||!local(req))throw new CommerceError('mock_local_only',403);
    const found=store().paymentOrder(req.params.payment);
    if(!found||found.account!==account(req))throw new CommerceError('story_not_found',404);
    adapter.decide(req.params.payment,req.body?.decision==='success');res.redirect(303,'/?stories=1');
  }));
  app.post('/api/stories/:id/answers',route((req,res)=>{
    const parsed=parsePersonalMythRequest({request_id:key(req.body?.request_key),answers:req.body?.answers});
    const question=String(req.body?.question||'').trim();if(question.length>2000)throw new CommerceError('question_too_long',400);
    res.json({order:publicOrder(store().saveAnswers(account(req),req.params.id,parsed.answers,question))});
  }));
  async function generate(req:Request,res:Response,order:StoryOrder,requestKey:string,kind:'myth'|'albert',input:any,createdAccount?:string){
    const db=store(),id=createdAccount||account(req);
    const reserved=db.reserve(id,order.id,requestKey,kind,kind==='albert'?{message:input.message}:{answers:input.answers});
    if(reserved.state==='complete')return res.json({...reserved.result,order:publicOrder(db.order(id,order.id)),replayed:true});
    if(reserved.state!=='reserved')return res.status(202).json({status:reserved.state,order:publicOrder(db.order(id,order.id))});
    try{
      let result:any;
      const safety=kind==='albert'?checkSafety(input):null;
      if(kind==='myth' && containsCrisisLanguage(input.answers))result={status:'crisis',ui:{safe_message:SAFE_CRISIS_MESSAGE}};
      else if(safety?.isCrisis)result={status:'crisis',response:safety.safeMessage,ui:{safe_message:safety.safeMessage}};
      else{
        if(preview.enabled()&&order.kind==='free'){
          if(kind==='albert')preview.requireContinuation(order.id);
          if(!availability().can_start_myth)throw new CommerceError('free_budget_exhausted',503);
        }
        if(!options.ready())throw new CommerceError('provider_not_ready',503);
        if(!checkAndIncrementRate('generate:'+req.ip,30,Date.now(),600000,buckets).allowed)throw new CommerceError('rate_limit',429);
        if(order.kind==='free'&&!consumeDailyBudget().allowed)throw new CommerceError('daily_budget_reached',429);
        if(kind==='myth')db.event('experience_started',order);
        result=await withAIBudget({pool:order.kind==='paid'?'paid':'free',orderId:order.kind==='paid'?order.id:undefined},()=>kind==='myth'?options.myth(input):options.albert(input,res.locals.consent));
      }
      if(result.status==='ok' && kind==='albert'){
        result={...result,reply:result.response||result.message};
        if(typeof result.reply!=='string'||!result.reply.trim())throw new CommerceError('empty_albert_response',502);
      }
      if(!['ok','crisis'].includes(result.status))throw new CommerceError('generation_not_delivered',502);
      const updated=db.complete(id,order.id,requestKey,result,kind==='albert'?input.message:undefined);
      return res.json({...result,order:publicOrder(updated)});
    }catch(error:any){
      const code=error?.canonical_error;
      if(['paid_service_waiting','free_budget_exhausted','ai_budget_unconfigured','ai_budget_recovery_waiting','ai_tariffs_stale','ai_concurrency_limit'].includes(code))error=new CommerceError(code,code==='ai_concurrency_limit'?429:503);
      try{db.fail(id,order.id,requestKey);Object.assign(error,{operation_failed:true});}catch{/* Deletion/revocation wins over a delayed response. */}throw error;
    }
  }
  app.post('/api/stories/:id/myth',route(async(req,res)=>{
    const order=store().order(account(req),req.params.id),requestKey=key(req.body?.request_key);
    const input=parsePersonalMythRequest({request_id:requestKey,answers:order.data.answers});
    return generate(req,res,order,requestKey,'myth',input);
  }));
  app.post('/api/stories/:id/albert',route(async(req,res)=>{
    const order=store().order(account(req),req.params.id),message=parseAlbertMessage(req.body);
    const m=order.data.myth;
    // Ordinary Albert gets actual saved answers, issued Myth and the human's question, never a model's invented choice.
    const input={message,history:order.data.messages,context:{storyInputs:order.data.answers,storyResult:m,userQuestion:order.data.question,
      mythAnchors:m?{title:m.title,...m.mirror,oneStep:m.one_step}:undefined}};
    return generate(req,res,order,key(req.body?.request_key),'albert',input);
  }));
  app.post('/api/stories/:id/retry-interrupted',route((req,res)=>{
    if(req.body?.acknowledged!==true)throw new CommerceError('explicit_retry_required',400);
    store().acknowledgeUncertain(account(req),req.params.id);res.json({acknowledged:true});
  }));
  app.post('/api/stories/:id/note',route((req,res)=>{
    const note=req.body?.note;if(typeof note!=='string'||note.length>12000)throw new CommerceError('note_invalid',400);
    store().note(account(req),req.params.id,note);res.json({saved:true});
  }));
  app.post('/api/stories/:id/support',route((req,res)=>{
    if(!['delivery','refund'].includes(req.body?.reason))throw new CommerceError('support_reason_invalid',400);
    store().support(account(req),req.params.id,req.body.reason);res.json({recorded:true,order_id:req.params.id});
  }));
  app.post('/api/stories/:id/pdf',route((req,res)=>{
    const order=store().order(account(req),req.params.id);
    if(!order.data.myth)throw new CommerceError('story_not_issued');
    const pdf=makeStoryPdf(order);store().event('pdf_exported',order);res.set('Content-Disposition','attachment; filename="personal-story.pdf"').type('application/pdf').send(pdf);
  }));
  app.post('/api/stories/:id/feedback',route((req,res)=>{
    const id=account(req),order=store().order(id,req.params.id);if(!order.data.myth)throw new CommerceError('story_not_issued');
    if(req.body?.accepted!==true||req.body?.version!==PREVIEW_FEEDBACK_VERSION)throw new CommerceError('feedback_consent_required',403);
    const text=req.body?.text;if(typeof text!=='string'||!text.trim()||text.length>2000)throw new CommerceError('feedback_invalid',400);
    store().previewFeedback(id,order.id,text.trim());res.json({saved:true});
  }));
  app.post('/api/stories/delete',route((req,res)=>{
    if(req.body?.confirmed!==true)throw new CommerceError('explicit_deletion_required',400);
    store().deleteAccount(account(req));res.clearCookie(COOKIE,{path:'/'});res.json({deleted:true});
  }));
  // The accepted free Myth route is tracked when commerce is enabled; already-issued UI results remain readable.
  app.post('/api/personal-myth',(req,res,next)=>{
    if(!enabled())return next();
    if(preview.enabled()&&!preview.status().active&&!cookie(req,COOKIE))return next();
    return route(async()=>{
      if(!sameOrigin(req))throw new CommerceError('origin_rejected',403);
      const parsed=parsePersonalMythRequest(req.body),requestKey=key(parsed.request_id);
      if(containsCrisisLanguage(parsed.answers))return res.json({mode:'story',status:'crisis',ui:{safe_message:SAFE_CRISIS_MESSAGE}});
      const db=store();let id=db.account(cookie(req,COOKIE));
      const existing=id?db.list(id).find(order=>order.kind==='free'):undefined;
      if(preview.enabled()&&!existing?.data.myth&&!availability().can_start_myth)throw new CommerceError('free_budget_exhausted',503);
      if(!id){
        if(!checkAndIncrementRate('account:'+req.ip,10,Date.now(),600000,buckets).allowed)throw new CommerceError('account_rate_limit',429);
        const created=db.createAccount();id=created.id;setAccess(res,created.access);
      }
      let order=db.createOrder(id,requestKey,'free',process.env.NODE_ENV!=='production');
      if(preview.status().active&&order.created_at>=preview.status().started_at!)preview.mark(order.id);
      if(order.state==='ready'){
        if(JSON.stringify(order.data.answers)!==JSON.stringify(parsed.answers))throw new CommerceError('free_story_already_issued',402);
        return res.json({status:'ok',mode:'story',story_result:order.data.myth,replayed:true});
      }
      if(!order.data.answers)order=db.saveAnswers(id,order.id,parsed.answers,'');
      if(JSON.stringify(order.data.answers)!==JSON.stringify(parsed.answers))throw new CommerceError('saved_answers_differ',409);
      return generate(req,res,order,requestKey,'myth',parsed,id);
    })(req,res);
  });
  // General deletion additionally clears paid history. A missing legacy token does not authorize a stranger.
  const deleteOwned=(req:Request,res:Response)=>{
    if(!enabled() || !cookie(req,COOKIE))return false;
    const db=store(),id=db.account(cookie(req,COOKIE));if(!id)return false;
    if(!sameOrigin(req))throw new CommerceError('origin_rejected',403);
    db.deleteAccount(id);res.clearCookie(COOKIE,{path:'/'});return true;
  };
  const readiness=()=>({process_up:true,storage_configured:Boolean(options.store||process.env.COMMERCE_DATA_KEY),provider_configured:options.ready(),financial_policy_approved:budget.configured(),new_paid_obligation_capacity:budget.capacity(),payment_mode:process.env.COMMERCE_PAYMENT_MODE||'disabled',merchant_network_verified:null,new_live_payments_configuration_ready:liveCheckoutConfigured(process.env)&&budget.capacity(),merchant_verification_scope:'NOT_CHECKED_BY_THIS_HEALTH_ENDPOINT'});
  return {deleteOwned,store,readiness};
}
