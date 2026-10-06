import React,{useEffect,useRef,useState} from 'react';
import {useProtectedFetch} from './ConsentBoundary';
import type {StoryInputs} from '../types';
import './personalStoryLibrary.css';

type Order={id:string;kind:'free'|'paid';state:string;test:boolean;remaining:number;pending:number;data:{answers?:StoryInputs;question?:string;myth?:any;messages:{role:string;content:string}[];note:string}};
const empty={q1:'',q2:'',q3:'',q4:''};
const questions=[
  ['q1','В какой ситуации тебе сейчас хочется лучше понять себя?'],
  ['q2','Какой предмет, место или образ точнее всего передаёт это состояние?'],
  ['q3','Когда за последнее время ты почувствовал: «вот здесь я на своём месте»?'],
  ['q4','Чего тебе хочется больше в этой ситуации?'],
] as const;
const newKey=()=>crypto.randomUUID();
const draftPrefix='zerkalo.storyDraft.';
const readDraft=(id:string)=>{try{return JSON.parse(sessionStorage.getItem(draftPrefix+id)||'null');}catch{return null;}};
function clearDrafts(){for(const key of Object.keys(sessionStorage))if(key.startsWith(draftPrefix))sessionStorage.removeItem(key);}

export function PersonalStoryLibrary({isOpen,onClose,onStoriesDeleted,previousAnswers,previousMyth}:{isOpen:boolean;onClose:()=>void;onStoriesDeleted:()=>void;previousAnswers?:StoryInputs|null;previousMyth?:any}){
  const protectedFetch=useProtectedFetch();
  const [orders,setOrders]=useState<Order[]>([]),[selected,setSelected]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState('disabled');
  const [answers,setAnswers]=useState<StoryInputs>(empty),[question,setQuestion]=useState(''),[message,setMessage]=useState(''),[note,setNote]=useState('');
  const [recovery,setRecovery]=useState(''),[restoreCode,setRestoreCode]=useState(''),[savedCode,setSavedCode]=useState(false),[deleteChecked,setDeleteChecked]=useState(false);
  const [sample,setSample]=useState<any>(null);
  const [receiptEmail,setReceiptEmail]=useState('');
  const [storageAccepted,setStorageAccepted]=useState(false),[storageChecked,setStorageChecked]=useState(false);
  const [crisisBlocked,setCrisisBlocked]=useState(false);
  const generation=useRef(0),request=useRef<AbortController|null>(null),lock=useRef(false),started=useRef(false);
  const keys=useRef<Record<string,string>>({});
  const order=orders.find(o=>o.id===selected);
  const freeDone=orders.some(o=>o.kind==='free'&&o.state==='ready');
  const updateOrder=(value:Order)=>{setOrders(old=>[value,...old.filter(o=>o.id!==value.id)]);setSelected(value.id);};
  const choose=(value:Order)=>{
    const draft=readDraft(value.id);setSelected(value.id);setAnswers(value.data.answers||draft?.answers||empty);setQuestion(value.data.question||draft?.question||'');setMessage(draft?.message||'');setNote(value.data.note||'');keys.current=draft?.keys||{};setError('');setNotice('');
  };
  const saveDraft=()=>{if(order)sessionStorage.setItem(draftPrefix+order.id,JSON.stringify({answers,question,message,keys:keys.current}));};
  useEffect(()=>{saveDraft();},[answers,question,message,selected]);
  const run=async(fn:(epoch:number)=>Promise<void>)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');const epoch=generation.current;
    try{await fn(epoch);}catch(e:any){if(epoch===generation.current&&e.name!=='AbortError')setError(e.message||'Не удалось завершить действие. Ввод сохранён; сначала проверьте историю.');}
    finally{if(epoch===generation.current)setBusy(false);lock.current=false;}
  };
  const api=async(url:string,body:any,epoch:number)=>{
    const controller=new AbortController();request.current=controller;
    const response=await protectedFetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response)throw new Error('Действие отменено. Введённый текст сохранён.');
    const result=await response.json();
    if(epoch!==generation.current)throw new DOMException('Сессия изменилась','AbortError');
    if(!response.ok){
      if(result.operation_failed===true){if(url.endsWith('/myth'))delete keys.current.myth;if(url.endsWith('/albert'))delete keys.current.albert;saveDraft();}
      throw Object.assign(new Error(result.ui?.safe_message||result.code||'Не удалось завершить действие.'),{code:result.code});
    }
    return result;
  };
  const reload=async(epoch:number)=>{
    const result=await api('/api/stories',undefined,epoch);setOrders(result.orders);
    const active=result.orders.find((o:Order)=>o.id===selected)||result.orders[0];if(active)choose(active);
  };
  useEffect(()=>{
    if(!isOpen){started.current=false;generation.current++;request.current?.abort();return;}
    if(started.current)return;started.current=true;
    void run(async epoch=>{
      const status=await fetch('/api/stories/status',{cache:'no-store'}).then(r=>r.json());if(epoch!==generation.current)return;setMode(status.payment_mode);
      if(!status.enabled){setNotice('Сохранение и оплата этой версии пока не включены. Бесплатные результаты остаются доступны.');return;}
      setStorageAccepted(status.storage_accepted);
      if(!status.storage_accepted)return;
      await api('/api/stories/account',{},epoch);await reload(epoch);
      await api('/api/stories/offer',{},epoch);
    });
  },[isOpen]);
  const createOrder=()=>run(async epoch=>{
    const requestKey=keys.current.purchase ||= newKey();
    const result=await api('/api/stories/orders',{request_key:requestKey},epoch);choose(result.order);updateOrder(result.order);
    const checkout=await api(`/api/stories/${result.order.id}/checkout`,{receipt_email:receiptEmail},epoch);
    window.location.assign(checkout.url);
  });
  const generateMyth=()=>run(async epoch=>{
    if(!order)return;
    if(!order.data.answers){
      const result=await api(`/api/stories/${order.id}/answers`,{request_key:newKey(),answers,question},epoch);updateOrder(result.order);
    }
    const requestKey=keys.current.myth ||= newKey();saveDraft();
    const result=await api(`/api/stories/${order.id}/myth`,{request_key:requestKey},epoch);
    if(result.order)updateOrder(result.order);
    if(result.status==='ok'){setNotice('Новая история сохранена. Можно продолжить с Альбертом.');delete keys.current.myth;saveDraft();}
    else if(result.status==='crisis'){setCrisisBlocked(true);setNotice(result.ui?.safe_message||result.response);delete keys.current.myth;saveDraft();}
    else setNotice('Запрос уже существует. Кнопка «Проверить сохранённую историю» не запускает генерацию.');
  });
  const send=()=>run(async epoch=>{
    if(!order||!message.trim())return;
    const requestKey=keys.current.albert ||= newKey();saveDraft();
    const result=await api(`/api/stories/${order.id}/albert`,{request_key:requestKey,message},epoch);
    if(result.order)updateOrder(result.order);
    if(result.status==='ok'){setMessage('');delete keys.current.albert;sessionStorage.removeItem(draftPrefix+order.id);}
    else if(result.status==='crisis'){setCrisisBlocked(true);setNotice(result.ui?.safe_message||result.response);delete keys.current.albert;}
    else setNotice('Проверьте сохранённую историю: запрос уже выполняется. Повтор не создаёт новый ответ.');
  });
  const download=()=>run(async epoch=>{
    if(!order)return;
    const response=await protectedFetch(`/api/stories/${order.id}/pdf`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    if(!response)return;if(!response.ok)throw new Error('PDF сейчас недоступен. История остаётся сохранённой.');
    const blob=await response.blob();if(epoch!==generation.current)return;
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='personal-story.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  });
  const erase=()=>{
    // Invalidate pending UI updates immediately, but authorize deletion through the real server.
    generation.current++;request.current?.abort();lock.current=false;setBusy(false);
    void run(async epoch=>{
      await api('/api/stories/delete',{confirmed:true},epoch);generation.current++;
      clearDrafts();keys.current={};setOrders([]);setSelected('');setAnswers(empty);setQuestion('');setMessage('');setNote('');setRecovery('');setRestoreCode('');setDeleteChecked(false);setSavedCode(false);setBusy(false);
      setStorageAccepted(false);setStorageChecked(false);onStoriesDeleted();setNotice('Сохранённые истории и их тексты удалены. Код восстановления больше не действует. Минимальные сведения об оплате могут сохраняться для возврата.');
    });
  };
  const restore=()=>run(async epoch=>{await api('/api/stories/restore',{recovery:restoreCode},epoch);keys.current={};setRecovery('');setSavedCode(true);setStorageAccepted(true);await reload(epoch);setRestoreCode('');setNotice('Истории восстановлены. Никакая генерация не запускалась.');});
  if(!isOpen)return null;
  return <div className="story-overlay"><section className="story-library" role="dialog" aria-modal="true" aria-labelledby="story-title">
    <header><h1 id="story-title">Новая личная история</h1><button aria-label="Закрыть истории" onClick={()=>{generation.current++;request.current?.abort();lock.current=false;setBusy(false);onClose();}}>×</button></header>
    <p className="story-price">790 ₽ · одна покупка</p>
    <p>Первая полная история бесплатна. За новую покупку: новый Миф из новых ответов, до пяти успешно выданных ответов Альберта, сохранение и PDF. Код и уже полученные результаты остаются доступны.</p>
    <p className="story-muted">Истории и ответы создаёт ИИ. Миф опирается на четыре ответа, не на числовой расчёт. Вопрос передаётся Альберту. Его предложения не являются вашим решением.</p>
    {mode!=='live'&&<p className="story-test" role="status">{mode==='mock'?'Имитация оплаты — деньги не списываются. Это не тестовый магазин.':mode==='test'?'Тестовый магазин — настоящие продажи закрыты.':'Оплата ещё не подключена. Настоящие продажи закрыты.'}</p>}
    {error&&<p className="story-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="story-actions"><button disabled={busy} onClick={()=>run(async()=>{const data=await fetch('/api/stories-sample').then(r=>r.json());setSample(data);})}>Посмотреть полный образец</button><a href="/api/stories-sample/pdf" download>PDF образца</a></div>
    {sample&&<article className="story-prose"><h2>Вымышленный демонстрационный случай</h2><p>Подготовленный образец состава услуги; не новый живой результат и не история покупателя.</p>{sample.sections.map((s:any,i:number)=><section key={i}><h3>{s.title}</h3><p>{s.body}</p></section>)}<button onClick={()=>setSample(null)}>Свернуть образец</button></article>}
    <h2>Мои истории</h2>
    {!storageAccepted&&<section><p>Бесплатный Миф остаётся доступен в текущем браузере. Долговременный архив включается только по вашему согласию. До этого сервер использует кратковременный кэш для восстановления запроса.</p><label><input type="checkbox" checked={storageChecked} onChange={e=>setStorageChecked(e.target.checked)}/> Я согласен сохранять мои истории и сообщения на сервере до моего удаления. Доступ — через этот браузер и личный код восстановления.</label><button disabled={busy||!storageChecked} onClick={()=>run(async epoch=>{await api('/api/stories/account',{storage_accepted:true,storage_version:'personal-history-storage-v1'},epoch);setStorageAccepted(true);await reload(epoch);await api('/api/stories/offer',{},epoch);})}>Включить сохранение историй</button></section>}
    {orders.map(o=><button className="story-row" disabled={busy} key={o.id} onClick={()=>choose(o)}>{o.data.myth?.title||(o.kind==='paid'?'Новая история':'Первая история')} · {o.state==='ready'?'сохранена':o.state==='pending_payment'?'ожидает оплаты':o.state==='paid'?'оплачена':o.state==='canceled'?'отмена':o.state==='refunded'?'возврат':o.state==='generating'?'запрос выполнялся':o.state==='generation_failed'?'выдача не завершена':'ответы сохранены'}</button>)}
    {storageAccepted&&previousMyth&&previousAnswers&&!orders.some(o=>o.kind==='free'&&o.data.myth)&&<button disabled={busy} onClick={()=>run(async epoch=>{const result=await api('/api/stories/import-free',{answers:previousAnswers,myth:previousMyth},epoch);choose(result.order);updateOrder(result.order);})}>Сохранить мой ранее полученный бесплатный Миф</button>}
    <div className="story-recovery"><h3>Доступ после закрытия браузера</h3><p>В этом браузере истории открываются повторно. Для другого устройства сохраните личный код. Тот, у кого есть код, получает доступ к вашим историям. Не публикуйте его.</p>
      <button disabled={busy||!orders.length} onClick={()=>run(async epoch=>{const data=await api('/api/stories/recovery',{},epoch);setRecovery(data.recovery);setSavedCode(false);})}>Получить код восстановления</button>
      {recovery&&<><code>{recovery}</code><button onClick={()=>{const url=URL.createObjectURL(new Blob([recovery],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='zerkalo-recovery.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}>Скачать код</button><label><input type="checkbox" checked={savedCode} onChange={e=>setSavedCode(e.target.checked)}/> Я сохранил код в безопасном месте</label></>}
      <label>Код для восстановления<input value={restoreCode} onChange={e=>setRestoreCode(e.target.value)} autoComplete="off"/></label><button disabled={busy||!restoreCode.trim()} onClick={restore}>Восстановить истории</button>
    </div>
    {freeDone&&!crisisBlocked&&<><p>790 ₽ за одну новую историю. Не подписка. Ошибка или кризисный ответ не расходуют пять ответов. При сбое — повторное открытие истории, ограниченный повтор или обращение по номеру заказа для выдачи/возврата. Новая генерация не начинается сама при перезагрузке.</p>{mode==='live'&&<label>Электронная почта для чека<input type="email" value={receiptEmail} maxLength={254} onChange={e=>setReceiptEmail(e.target.value)}/></label>}<button disabled={busy||!savedCode||mode==='disabled'||(mode==='live'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail))} onClick={createOrder}>Купить новую историю — 790 ₽</button>{!savedCode&&<p>Перед оплатой получите и сохраните код восстановления.</p>}</>}
    {order&&<article className="story-prose"><h2>{order.data.myth?.title||'Ваш новый Миф'}</h2><small>Заказ {order.id}</small>
      {order.kind==='paid'&&<div><button disabled={busy} onClick={()=>run(async epoch=>{await api(`/api/stories/${order.id}/support`,{reason:'delivery'},epoch);setNotice(`Запрос помощи сохранён для заказа ${order.id}. В локальном тесте он не отправляется внешнему оператору.`);})}>Запросить помощь с выдачей</button><button disabled={busy} onClick={()=>run(async epoch=>{await api(`/api/stories/${order.id}/support`,{reason:'refund'},epoch);setNotice(`Запрос возврата сохранён для заказа ${order.id}. Это не выполненный возврат денег; решение и операция магазина ещё нужны.`);})}>Запросить возврат</button></div>}
      {order.test&&<p className="story-test">Тестовая история. Продажа не подтверждается этим экземпляром.</p>}
      {order.state==='pending_payment'&&<button disabled={busy} onClick={()=>run(async epoch=>{const data=await api(`/api/stories/${order.id}/payment-refresh`,{},epoch);choose(data.order);updateOrder(data.order);})}>Проверить оплату на сервере</button>}
      {['paid','answers_saved','generation_failed'].includes(order.state)&&!order.data.myth&&<>
        {questions.map(([id,label])=><label key={id}>{label}<textarea value={answers[id]} maxLength={1000} disabled={Boolean(order.data.answers)||busy} onChange={e=>setAnswers({...answers,[id]:e.target.value})}/></label>)}
        <label>Ваш вопрос Альберту (не обязателен)<textarea value={question} maxLength={2000} disabled={Boolean(order.data.answers)||busy} onChange={e=>setQuestion(e.target.value)}/></label>
        <button disabled={busy||questions.some(([id])=>answers[id].trim().length<3)} onClick={generateMyth}>Создать новый Миф</button>
      </>}
      <button disabled={busy} onClick={()=>run(epoch=>reload(epoch))}>Проверить сохранённую историю</button>
      {['generating','generation_failed'].includes(order.state)&&<button disabled={busy} onClick={()=>run(async epoch=>{await api(`/api/stories/${order.id}/retry-interrupted`,{acknowledged:true},epoch);delete keys.current.myth;delete keys.current.albert;saveDraft();await reload(epoch);setNotice('Следующая попытка — только по вашему отдельному нажатию. Предыдущая могла завершиться у провайдера; её результат не подтверждён.');})}>Подтвердить ограниченный повтор после сбоя</button>}
      {order.data.myth&&<>
        <h3>Миф — текст ИИ</h3><p>{order.data.myth.story}</p><h3>Зеркало — взгляд ИИ</h3>{Object.values(order.data.myth.mirror||{}).map((text:any,i)=><p key={i}>{text}</p>)}
        <h3>Возможные смыслы</h3>{order.data.myth.meaning?.map((text:string,i:number)=><p key={i}>{text}</p>)}<p>{order.data.myth.one_step}</p><p>{order.data.myth.journal_question}</p><p>{order.data.myth.disclaimer}</p>
        <h3>Альберт — ИИ-собеседник</h3><p>Осталось ответов: <strong>{order.remaining}</strong> из 5. Засчитывается только успешно сохранённый ответ.</p>
        {order.data.messages.map((m,i)=><section key={i} className={'story-message '+m.role}><strong>{m.role==='user'?'Вы':'Альберт — ИИ'}</strong><p>{m.content}</p></section>)}
        {order.remaining>0&&order.state==='ready'?<><label>Ваше сообщение Альберту<textarea value={message} maxLength={2000} disabled={busy} onChange={e=>{setMessage(e.target.value);delete keys.current.albert;}}/></label><button disabled={busy||!message.trim()} onClick={send}>Отправить Альберту</button></>:<p>Новые ответы в этом заказе закончились или недоступны. Сохранённые тексты и PDF можно открыть снова.</p>}
        <label>Ваша заметка — слова человека<textarea value={note} maxLength={12000} onChange={e=>setNote(e.target.value)}/></label><button disabled={busy} onClick={()=>run(async epoch=>{await api(`/api/stories/${order.id}/note`,{note},epoch);await reload(epoch);setNotice('Ваша заметка сохранена отдельно от слов ИИ.');})}>Сохранить мою заметку</button><button disabled={busy} onClick={download}>Скачать историю PDF</button>
      </>}
    </article>}
    {!!orders.length&&<section><h3>Удаление сохранённых историй</h3><label><input type="checkbox" checked={deleteChecked} onChange={e=>setDeleteChecked(e.target.checked)}/> Удалить тексты всех сохранённых историй и код доступа. Это действие нельзя отменить.</label><button disabled={!deleteChecked} onClick={erase}>Удалить сохранённые истории</button></section>}
    <p><a href="/terms" target="_blank" rel="noreferrer">Условия</a> · <a href="/privacy" target="_blank" rel="noreferrer">Обработка данных</a></p>
  </section></div>;
}
