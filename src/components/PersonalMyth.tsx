import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, BookOpen, Sparkles, Feather, Archive } from 'lucide-react';
import { ApiResponse, StoryInputs } from '../types';

export default function PersonalMyth() {
  const [step, setStep] = useState(0); // 0 = Intro, 1-4 = questions, 5 = generating, 6 = result
  const [inputs, setInputs] = useState<StoryInputs>({ q1: '', q2: '', q3: '', q4: '' });
  const [result, setResult] = useState<ApiResponse['story_result'] | null>(null);
  const [errorText, setErrorText] = useState('');
  const [safeMessage, setSafeMessage] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

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
        mainImage: inputs.q2 || "—",
        innerTension: "—",
        hiddenResource: inputs.q4 || "—",
        newView: "—"
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
      } else if (data.status === 'error') {
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
                className="px-8 py-4 bg-[#1A2621] text-[#A3B8AD] border border-[#2A3B33] hover:bg-[#202F29] hover:border-[#3A4B43] tracking-widest uppercase text-xs transition-colors"
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
                   <button onClick={() => setStep(step - 1)} className="text-xs text-gray-500 hover:text-gray-300">Назад</button>
                )}
              </div>
              
              <h3 className="font-serif text-2xl md:text-3xl text-[#EAEAEA] mb-8 leading-snug">
                {steps[step - 1].title}
              </h3>
              
              <textarea 
                autoFocus
                className="w-full bg-transparent border-b border-[#2A3B33] text-[#EAEAEA] placeholder:text-[#3A4B43] text-lg font-serif py-4 outline-none focus:border-[#A3B8AD] transition-colors resize-none mb-10 h-32"
                placeholder={steps[step - 1].placeholder}
                value={inputs[steps[step - 1].id as keyof StoryInputs]}
                onChange={(e) => setInputs({ ...inputs, [steps[step - 1].id]: e.target.value })}
              />
              
              {errorText && (
                <div className="mb-6 bg-red-900/20 text-red-400 border border-red-900/50 p-4 text-sm font-sans">
                  {errorText}
                </div>
              )}

              <button 
                onClick={handleNext}
                disabled={inputs[steps[step - 1].id as keyof StoryInputs].length < 3}
                className="self-end px-8 py-4 bg-[#1A2621] text-[#A3B8AD] disabled:opacity-50 disabled:cursor-not-allowed border border-[#2A3B33] hover:bg-[#202F29] tracking-widest uppercase text-xs transition-colors"
              >
                {step === 4 ? 'Сплести сказку' : 'Дальше'}
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
                      {result.meaning.map((m, i) => (
                        <li key={i} className="flex gap-4">
                          <span className="text-[#A3B8AD] opacity-50">—</span>
                          <span dangerouslySetInnerHTML={{ __html: m.replace(/\\*\\*(.*?)\\*\\*/g, '<span class="text-gray-200">$1</span>') }} />
                        </li>
                      ))}
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
                   <button className="px-6 py-3 bg-[#A3B8AD] text-[#0F1412] tracking-widest uppercase text-xs font-medium hover:bg-[#8CA296] transition-colors" onClick={() => alert("Открытие модального окна заявки...")}>
                     Получить Большое исследование
                   </button>
                   <button onClick={() => { setStep(0); setInputs({q1:'', q2:'', q3:'', q4:''}) }} className="px-6 py-3 bg-transparent border border-[#2A3B33] text-[#A3B8AD] tracking-widest uppercase text-xs hover:text-[#EAEAEA] transition-colors">
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
            Это образная история для саморефлексии. Она не является руководством к действию или единственно верным прочтением. Если вы чувствуете сильное внутреннее напряжение, лучше обратиться к живому специалисту.
          </p>
        </div>

      </div>
    </div>
  );
}
