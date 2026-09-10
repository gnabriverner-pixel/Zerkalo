import React,{useEffect,useState} from 'react';
import {acceptConsent} from '../services/consent';

export function ConsentBoundary({children}:{children:React.ReactNode}) {
  const [ready,setReady]=useState(false),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{fetch('/api/consent').then(r=>r.json()).then(r=>setReady(r.accepted===true)).catch(()=>setError('Не удалось проверить согласие. Можно повторить ниже.'));},[]);
  if(ready)return <>{children}</>;
  return <main className="min-h-screen bg-[#090D15] text-stone-100 flex items-center justify-center px-5 py-12">
    <section className="max-w-xl w-full space-y-6" aria-labelledby="consent-heading">
      <p className="text-sm text-[#C8A45D]">Зеркало себя · Перед первым зеркалом</p>
      <h1 id="consent-heading" className="font-serif text-3xl leading-tight">Ваш опыт остаётся вашим</h1>
      <p className="text-base leading-relaxed text-stone-300">Код использует дату рождения для расчёта. Миф и Альберт передают ваши ответы AI-провайдеру для создания текста. Не указывайте чужие личные данные. Это пространство самоисследования, не диагностика.</p>
      <p className="text-base leading-relaxed text-stone-300">Сохранение в браузере — по вашему выбору. Перенос контекста в Telegram потребует отдельного согласия. Автоматические сообщения этим согласием не включаются.</p>
      <nav className="flex flex-wrap gap-5 text-[#C8A45D]"><a href="/privacy" target="_blank" rel="noreferrer" className="underline py-2">Обработка данных</a><a href="/terms" target="_blank" rel="noreferrer" className="underline py-2">Условия использования</a></nav>
      <label className="flex items-start gap-3 min-h-11 cursor-pointer text-base leading-relaxed"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} className="mt-1 size-5 shrink-0"/>Мне исполнилось 18 лет. Я прочитал(а) условия и согласен(на) на описанную обработку данных для работы зеркал и диалога.</label>
      {error&&<p role="alert" className="text-amber-300">{error}</p>}
      <button disabled={!checked||busy} className="min-h-12 px-6 py-3 bg-[#C8A45D] text-gray-950 disabled:opacity-40 rounded-sm" onClick={async()=>{setBusy(true);setError('');try{await acceptConsent('core');setReady(true);}catch{setError('Согласие не сохранено. Попробуйте ещё раз.');}finally{setBusy(false);}}}>{busy?'Сохраняем согласие…':'Продолжить к зеркалам'}</button>
    </section>
  </main>;
}
