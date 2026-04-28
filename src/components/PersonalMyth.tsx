import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, BookOpen, Sparkles, Feather, Archive, X } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { ApiResponse, StoryInputs } from '../types';

registerLocale('ru', ru);

export default function PersonalMyth() {
  const [step, setStep] = useState(0); // 0 = Intro, 1-4 = questions, 5 = generating, 6 = result
  const [inputs, setInputs] = useState<StoryInputs>({ q1: '', q2: '', q3: '', q4: '' });
  const [result, setResult] = useState<ApiResponse['story_result'] | null>(null);
  const [errorText, setErrorText] = useState('');
  const [safeMessage, setSafeMessage] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', birthDate: '', contact: '', request: '' });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [leadMessage, setLeadMessage] = useState('');
  const [date, setDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const themeByStep = [
    { color: 'transparent', shadow: 'transparent', name: '' },
    { color: '#8A5A44', shadow: 'rgba(138, 90, 68, 0.2)', name: 'Напряжение' }, // Шаг 1: Напряжение (тёмно-терракотовый)
    { color: '#7C9082', shadow: 'rgba(124, 144, 130, 0.2)', name: 'Образ' }, // Шаг 2: Образ (приглушенно-оливковый)
    { color: '#B59E74', shadow: 'rgba(181, 158, 116, 0.2)', name: 'Живость' }, // Шаг 3: Живость (старое золото)
    { color: '#6B7A87', shadow: 'rgba(107, 122, 135, 0.2)', name: 'Потребность' }  // Шаг 4: Потребность (сумеречно-сизый)
  ];

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadStatus('submitting');
    setLeadMessage('');

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          source: 'personal_myth_big_research'
        })
      });

      const data = await res.json();

      if (data.status === 'ok') {
        setLeadStatus('success');
        setLeadMessage(data.ui?.safe_message || 'Заявка принята. Я свяжусь с вами в Telegram и уточню детали Большого исследования.');
        setLeadForm({ name: '', birthDate: '', contact: '', request: '' });
      } else {
        setLeadStatus('error');
        setLeadMessage(data.ui?.safe_message || 'Пожалуйста, проверьте данные и попробуйте ещё раз.');
      }
    } catch (err) {
      setLeadStatus('error');
      setLeadMessage('Произошла ошибка при отправке. Пожалуйста, проверьте данные и попробуйте ещё раз.');
    }
  };

  const steps = [
      {
        id: 'q1',
        title: 'Что сейчас внутри требует внимания? Опишите не фактами, а ощущением.',
        placeholder: 'Например: тяжесть, шум, ожидание, пустота, развилка, застывшее движение...'
      },
      {
        id: 'q2',
        title: 'Если это состояние стало бы образом, существом, погодой, комнатой или предметом — что бы это было?',
        placeholder: 'Туман, закрытая дверь, дом без окон, зверь у порога, холодный сад...'
      },
      {
        id: 'q3',
        title: 'Вспомните момент, где вы чувствовали себя живее, яснее или ближе к себе. Что там было?',
        placeholder: 'Место, человек, дело, движение, звук, свет, состояние...'
      },
      {
        id: 'q4',
        title: 'Какого качества вам сейчас не хватает?',
        placeholder: 'Тишины, смелости, тепла, границы, движения, признания, воздуха, опоры...'
      }
  ];

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else handleGenerate();
  };

  const applyFallback = () => {
    setResult({
      title: "Отражение",
      story: "Сейчас личный миф не удалось собрать. Вы можете сохранить ответы и вернуться позже.",
      mirror: {
        mainImage: inputs.q2 || "Образ пока не назван",
        innerTension: inputs.q1 || "Состояние пока требует уточнения",
        hiddenResource: inputs.q4 || "Качество, которого сейчас не хватает",
        newView: inputs.q3 || "Точка живости пока не описана"
      },
      meaning: [],
      one_step: "Выберите одно маленькое действие, которое сегодня вернёт вам ощущение опоры: убрать лишнее, выйти на воздух, записать одну мысль или поговорить с человеком, которому доверяете.",
      journal_question: "Какое крошечное действие я могу сделать прямо сейчас?",
      disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию."
    });
    setStep(6);
  };

  const handleGenerate = async () => {
    setStep(5);
    setErrorText('');
    setSafeMessage('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'story', storyInputs: inputs })
      });
      const data: ApiResponse = await res.json();

      if (data.status === 'crisis') {
        setErrorText(data.ui?.safe_message || "Мы не можем сгенерировать историю в данный момент.");
        setStep(4);
      } else if (data.status === 'error' || data.status === 'demo' || !data.story_result) {
        if (data.ui?.safe_message) setSafeMessage(data.ui.safe_message);
        applyFallback();
      } else {
        if (data.ui?.safe_message) setSafeMessage(data.ui.safe_message);
        setResult(data.story_result || null);
        setStep(6);
      }
    } catch (err) {
      console.error(err);
      applyFallback();
    }
  };

  useEffect(() => {
    if (step === 6 && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    }
  }, [step]);

  return (
    <div className="flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 bg-[#0F1412] min-h-screen text-[#EAEAEA] font-sans">
      
      {/* Container limits width for reading comfort */}
      <div className="w-full max-w-2xl flex flex-col items-center">

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center w-full mt-10"
            >
              <h1 className="font-serif text-5xl md:text-6xl mb-4 text-[#F4F4F4]">Личный миф</h1>
              <h2 className="font-serif italic text-lg md:text-xl text-[#A3B8AD] mb-8">
                Сказка про тебя
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed mb-12 max-w-lg mx-auto">
                Образная история, которая помогает увидеть своё состояние со стороны и найти один мягкий следующий шаг.
              </p>
              
              <button 
                onClick={() => setStep(1)}
                className="px-10 py-4 bg-transparent text-[#EAEAEA] border border-[#2A3B33] hover:border-[#A3B8AD] hover:bg-[#1A2621] hover:shadow-[0_0_20px_rgba(163,184,173,0.1)] tracking-[0.2em] uppercase text-xs transition-all duration-500"
              >
                Собрать личный миф
              </button>
              
              <div className="mt-16 text-[10px] text-gray-600 tracking-wide uppercase">
                 Образный формат для саморефлексии. Не диагностика и не инструкция к действию.
              </div>
            </motion.div>
          )}

          {step > 0 && step <= 4 && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <span className="text-xs tracking-widest text-[#A3B8AD] uppercase">Шаг {step} из 4</span>
                {step > 1 && (
                   <button 
                     onClick={() => setStep(step - 1)} 
                     className="text-xs tracking-[0.15em] uppercase text-gray-500 hover:text-[#A3B8AD] transition-colors duration-300"
                   >
                     Назад
                   </button>
                )}
              </div>
              
              <h3 className="font-serif text-2xl md:text-3xl text-[#EAEAEA] mb-8 leading-snug">
                {steps[step - 1].title}
              </h3>
              
              <div className="relative mb-10 w-full group">
                <div 
                   className="absolute -inset-4 rounded-xl transition-all duration-700 blur-xl pointer-events-none"
                   style={{
                     backgroundColor: isFocused ? themeByStep[step]?.color : 'transparent',
                     opacity: isFocused ? 0.08 : 0,
                     boxShadow: isFocused ? `0 0 40px 10px ${themeByStep[step]?.shadow}` : 'none'
                   }}
                />
                
                <textarea 
                  autoFocus
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="relative z-10 w-full bg-transparent border-b text-[#EAEAEA] placeholder:text-[#3A4B43] text-lg font-serif py-4 outline-none transition-all duration-500 resize-none h-32 focus:bg-[#111A16]"
                  style={{
                    borderColor: isFocused ? themeByStep[step]?.color : '#2A3B33'
                  }}
                  placeholder={steps[step - 1].placeholder}
                  value={inputs[steps[step - 1].id as keyof StoryInputs]}
                  onChange={(e) => setInputs({ ...inputs, [steps[step - 1].id]: e.target.value })}
                />

                <div 
                  className="absolute right-0 -bottom-6 text-[10px] tracking-widest uppercase transition-all duration-500 pointer-events-none"
                  style={{
                     opacity: isFocused ? 0.8 : 0,
                     color: themeByStep[step]?.color,
                     transform: isFocused ? 'translateY(0)' : 'translateY(-10px)'
                  }}
                >
                  {themeByStep[step]?.name}
                </div>
              </div>
              
              {errorText && (
                <div className="mb-6 bg-red-900/20 text-red-400 border border-red-900/50 p-4 text-sm font-sans">
                  {errorText}
                </div>
              )}

              <button 
                onClick={handleNext}
                disabled={inputs[steps[step - 1].id as keyof StoryInputs].length < 3}
                className="self-end px-10 py-4 bg-transparent text-[#A3B8AD] border border-[#2A3B33] hover:border-[#A3B8AD] hover:text-[#EAEAEA] hover:bg-[#1A2621] tracking-[0.2em] uppercase text-xs transition-all duration-500 disabled:opacity-30 disabled:hover:border-[#2A3B33] disabled:hover:bg-transparent disabled:hover:text-[#A3B8AD] disabled:cursor-not-allowed"
              >
                {step === 4 ? 'Сплести сказку' : 'Далее'}
              </button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex flex-col items-center justify-center py-20 text-center"
            >
              <Loader2 className="w-8 h-8 text-[#A3B8AD] animate-spin mb-6" />
              <p className="font-serif text-xl italic text-[#EAEAEA] mb-4">Вплетаем нити в узор...</p>
              <p className="text-sm text-[#4A5D53]">Это может занять немного времени.</p>
            </motion.div>
          )}

          {step === 6 && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              ref={resultRef}
              className="w-full flex flex-col gap-16 py-10"
            >
              {safeMessage && (
                <div className="text-xs text-center p-4 border border-[#A3B8AD]/30 text-[#A3B8AD] bg-[#1A2621]/30">
                  {safeMessage}
                </div>
              )}
              
              {/* Title Block */}
              <div className="flex flex-col mb-4">
                 <span className="text-xs tracking-widest uppercase text-[#A3B8AD] mb-4">ЛИЧНЫЙ МИФ</span>
                 <h2 className="font-serif text-4xl text-[#F4F4F4]">{result.title}</h2>
              </div>

              {/* BLOCK 1: STORY */}
              <div className="flex flex-col">
                 <div className="font-serif text-lg md:text-xl leading-loose text-gray-300 space-y-6">
                    {result.story.split('\n\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                 </div>
              </div>

              <hr className="border-[#2A3B33] my-8" />

              {/* BLOCK 2: MIRROR */}
              <div className="flex flex-col space-y-12">
                 <div className="flex items-center gap-3 opacity-80">
                   <Sparkles className="w-4 h-4 text-[#A3B8AD]" />
                   <span className="text-xs tracking-widest uppercase text-[#A3B8AD]">Что в этом образе про вас</span>
                 </div>

                 {result.mirror && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-[#111A16] border border-[#2A3B33] p-6">
                       <h4 className="text-xs uppercase tracking-widest text-[#A3B8AD] mb-3">Главный образ</h4>
                       <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.mainImage}</p>
                     </div>
                     <div className="bg-[#111A16] border border-[#2A3B33] p-6">
                       <h4 className="text-xs uppercase tracking-widest text-[#A3B8AD] mb-3">Внутреннее напряжение</h4>
                       <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.innerTension}</p>
                     </div>
                     <div className="bg-[#111A16] border border-[#2A3B33] p-6">
                       <h4 className="text-xs uppercase tracking-widest text-[#A3B8AD] mb-3">Скрытый ресурс</h4>
                       <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.hiddenResource}</p>
                     </div>
                     <div className="bg-[#111A16] border border-[#2A3B33] p-6">
                       <h4 className="text-xs uppercase tracking-widest text-[#A3B8AD] mb-3">Новый взгляд</h4>
                       <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.newView}</p>
                     </div>
                   </div>
                 )}

                 {/* Fallback for meaning strings if API hasn't synced or legacy */}
                 {result.meaning && result.meaning.length > 0 && !result.mirror && (
                   <ul className="space-y-4 font-sans text-sm md:text-base text-gray-400">
                      {result.meaning.map((m, i) => {
                        const cleanText = m.replace(/\\*\\*(.*?)\\*\\*/g, '$1');
                        return (
                          <li key={i} className="flex gap-4">
                            <span className="text-[#A3B8AD] opacity-50">—</span>
                            <span>{cleanText}</span>
                          </li>
                        );
                      })}
                   </ul>
                 )}
              </div>

              {/* BLOCK 3: ONE STEP */}
              <div className="flex flex-col mt-12 bg-[#111A16] border border-[#2A3B33] p-8 -mx-4 sm:mx-0">
                 <div className="flex items-center gap-3 mb-4 opacity-80">
                   <Feather className="w-4 h-4 text-[#A3B8AD]" />
                   <span className="text-xs tracking-widest uppercase text-[#A3B8AD]">Один шаг сегодня</span>
                 </div>
                 <p className="font-serif text-xl italic text-[#EAEAEA]">
                   {result.one_step}
                 </p>
              </div>

              {/* BLOCK 4: JOURNAL */}
              <div className="flex flex-col mt-12">
                 <div className="flex items-center gap-3 mb-6 opacity-80">
                   <Archive className="w-4 h-4 text-[#A3B8AD]" />
                   <span className="text-xs tracking-widest uppercase text-[#A3B8AD]">Вопрос для дневника</span>
                 </div>
                 <p className="font-sans text-lg text-gray-300 mb-6">{result.journal_question || "Какой первый маленький шаг можно сделать сегодня?"}</p>
                 <textarea 
                    className="w-full bg-[#1A2621]/30 border border-[#2A3B33] text-[#EAEAEA] placeholder:text-[#3A4B43] text-base p-4 outline-none focus:border-[#A3B8AD] transition-colors resize-none h-32"
                    placeholder="Напишите здесь свои впечатления..."
                 />
              </div>

              {/* CTA Full Profile */}
              <div className="mt-16 text-center border p-8 border-[#2A3B33] bg-[#111A16]">
                <h3 className="font-serif text-2xl text-[#EAEAEA] mb-4">Собрать полное зеркало</h3>
                <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
                  Большое исследование соединяет вашу дату рождения, числовую архитектуру и образный слой в один персональный документ.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                   <button className="px-8 py-4 bg-[#A3B8AD] text-[#0F1412] tracking-[0.2em] font-sans uppercase text-xs font-medium border border-[#A3B8AD] hover:bg-[#8CA296] hover:border-[#8CA296] transition-all duration-500" onClick={() => setShowLeadForm(true)}>
                     Получить Большое исследование
                   </button>
                   <button onClick={() => { setStep(0); setInputs({q1:'', q2:'', q3:'', q4:''}) }} className="px-8 py-4 bg-transparent border border-[#2A3B33] text-[#A3B8AD] tracking-[0.2em] font-sans uppercase text-xs hover:text-[#EAEAEA] hover:border-[#A3B8AD] hover:bg-[#1A2621] transition-all duration-500">
                     Новый миф
                   </button>
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
        
        {/* Safety Footer */}
        <div className="mt-20 pt-8 border-t border-[#1A2621] w-full text-center pb-8">
          <p className="text-[10px] text-gray-600 max-w-sm mx-auto leading-relaxed uppercase tracking-wider">
            Это образная история для саморефлексии. Она не является руководством к действию или единственно верным прочтением. При ощущении небезопасности или потери контроля лучше обратиться к человеку рядом или профильному специалисту.
          </p>
        </div>

      </div>

      {/* Lead Form Modal */}
      <AnimatePresence>
        {showLeadForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1412]/90 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111A16] p-8 md:p-12 max-w-md w-full relative shadow-2xl border border-[#2A3B33]"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#A3B8AD] to-transparent opacity-20"></div>
              <button 
                onClick={() => setShowLeadForm(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-[#A3B8AD] transition-colors"
              >
                <X className="w-6 h-6" strokeWidth={1} />
              </button>
              
              <h3 className="font-serif text-3xl text-[#EAEAEA] mb-4">Большое исследование</h3>
              <p className="font-sans text-[0.95rem] text-gray-400 mb-8 leading-relaxed">Оставьте заявку, и я свяжусь с вами, чтобы обсудить детали и начать работу над вашим персональным разбором.</p>
              
              {leadStatus === 'success' ? (
                <div className="bg-[#1A2621]/30 border border-[#2A3B33] p-8 text-center font-serif text-[1.1rem]">
                  <p className="text-[#A3B8AD]">{leadMessage}</p>
                  <button 
                    onClick={() => setShowLeadForm(false)}
                    className="mt-8 px-8 py-3 bg-[#A3B8AD] text-[#0F1412] font-sans text-xs tracking-[0.15em] uppercase hover:bg-[#8CA296] transition-colors"
                  >
                    Закрыть
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="flex flex-col gap-5">
                  <input 
                    type="text" 
                    placeholder="Ваше имя" 
                    required
                    value={leadForm.name}
                    onChange={e => setLeadForm({...leadForm, name: e.target.value})}
                    className="w-full bg-transparent border-b border-[#2A3B33] p-4 font-serif text-lg outline-none focus:border-[#A3B8AD] text-[#EAEAEA] placeholder:text-[#3A4B43] transition-colors"
                  />
                  <input 
                    type="text" 
                    placeholder="Ваш контакт (Telegram, Email...)" 
                    required
                    value={leadForm.contact}
                    onChange={e => setLeadForm({...leadForm, contact: e.target.value})}
                    className="w-full bg-transparent border-b border-[#2A3B33] p-4 font-serif text-lg outline-none focus:border-[#A3B8AD] text-[#EAEAEA] placeholder:text-[#3A4B43] transition-colors"
                  />
                  <input 
                    type="text" 
                    placeholder="Дата рождения для полного исследования" 
                    required
                    value={leadForm.birthDate}
                    onChange={e => setLeadForm({...leadForm, birthDate: e.target.value})}
                    className="w-full bg-transparent border-b border-[#2A3B33] p-4 font-serif text-lg outline-none focus:border-[#A3B8AD] text-[#EAEAEA] placeholder:text-[#3A4B43] transition-colors"
                  />
                  <textarea 
                    placeholder="Короткий запрос (необязательно)" 
                    rows={3}
                    value={leadForm.request}
                    onChange={e => setLeadForm({...leadForm, request: e.target.value})}
                    className="w-full bg-transparent border-b border-[#2A3B33] p-4 font-serif text-lg outline-none focus:border-[#A3B8AD] text-[#EAEAEA] placeholder:text-[#3A4B43] transition-colors resize-none mt-2"
                  ></textarea>
                  
                  {leadStatus === 'error' && (
                    <div className="text-red-400 bg-red-900/20 p-3 text-sm font-sans mt-2 border border-red-900/50">{leadMessage}</div>
                  )}
                  
                  <button 
                    type="submit" 
                    disabled={leadStatus === 'submitting'}
                    className="mt-6 w-full py-5 bg-[#A3B8AD] text-[#0F1412] font-sans text-xs tracking-[0.15em] uppercase hover:bg-[#8CA296] transition-colors disabled:opacity-50 flex justify-center items-center"
                  >
                    {leadStatus === 'submitting' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Отправить заявку'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
