import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, BookOpen, Sparkles, Feather, Archive, X, Clock, Compass, Layers, GitFork } from 'lucide-react';
import { ApiResponse, StoryInputs } from '../types';
import { LeadModal } from './LeadModal';
import { CosmicParticleBackground } from './CosmicParticleBackground';
import { StarMap } from './StarMap';
import { MythTimeline } from './MythTimeline';
import { TesterFeedbackWidget } from './TesterFeedbackWidget';

interface PersonalMythProps {
  onOpenAbout?: () => void;
  onMythCompleted?: (inputs: StoryInputs, result: ApiResponse['story_result']) => void;
  onNavigateToMeeting?: () => void;
  hasCodeResult?: boolean;
}

export default function PersonalMyth({ 
  onOpenAbout,
  onMythCompleted,
  onNavigateToMeeting,
  hasCodeResult 
}: PersonalMythProps = {}) {
  const [step, setStep] = useState(0); // 0 = Intro, 1-4 = questions, 5 = generating, 6 = result
  const [inputs, setInputs] = useState<StoryInputs>({ q1: '', q2: '', q3: '', q4: '' });
  const [result, setResult] = useState<ApiResponse['story_result'] | null>(null);
  const [errorText, setErrorText] = useState('');
  const [safeMessage, setSafeMessage] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [resultTab, setResultTab] = useState<'all' | 'timeline' | 'story' | 'mirror'>('all');
  const resultRef = useRef<HTMLDivElement>(null);

  const themeByStep = [
    { color: 'transparent', shadow: 'transparent', name: '' },
    { color: '#8A5A44', shadow: 'rgba(138, 90, 68, 0.2)', name: 'Напряжение' }, // Шаг 1: Напряжение (тёмно-терракотовый)
    { color: '#7C9082', shadow: 'rgba(124, 144, 130, 0.2)', name: 'Образ' }, // Шаг 2: Образ (приглушенно-оливковый)
    { color: '#B59E74', shadow: 'rgba(181, 158, 116, 0.2)', name: 'Живость' }, // Шаг 3: Живость (старое золото)
    { color: '#6B7A87', shadow: 'rgba(107, 122, 135, 0.2)', name: 'Потребность' }  // Шаг 4: Потребность (сумеречно-сизый)
  ];

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
        if (data.story_result && onMythCompleted) {
          onMythCompleted(inputs, data.story_result);
        }
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
    <div className="flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 bg-[#0F1412] min-h-screen text-[#EAEAEA] font-sans relative overflow-x-hidden">
      <CosmicParticleBackground />
      
      {/* Container limits width for reading comfort */}
      <div className="w-full max-w-2xl flex flex-col items-center relative z-10">

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center w-full mt-10"
            >
              <h1 className="font-serif text-5xl md:text-6xl mb-4 text-[#F4F4F4] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">Личный миф</h1>
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
              
              <div className="mt-16 text-[10px] text-gray-500 tracking-wide uppercase flex flex-col sm:flex-row items-center justify-center gap-2">
                 <span>Образный формат для саморефлексии. Не диагностика и не инструкция к действию.</span>
                 {onOpenAbout && (
                   <button
                     type="button"
                     onClick={onOpenAbout}
                     className="text-[#A3B8AD] hover:underline hover:text-[#EAEAEA] transition-colors"
                   >
                     О методе
                   </button>
                 )}
              </div>

              <StarMap />
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
              <div className="flex justify-between items-center mb-4">
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

              {/* Interactive Timeline Progress */}
              <MythTimeline inputs={inputs} currentStep={step} mode="interactive" />
              
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
              
              {/* Title Block & View Mode Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4 pb-4 border-b border-[#2A3B33]">
                 <div className="flex flex-col">
                   <span className="text-xs tracking-widest uppercase text-[#A3B8AD] mb-2">ЛИЧНЫЙ МИФ</span>
                   <h2 className="font-serif text-3xl sm:text-4xl text-[#F4F4F4]">{result.title}</h2>
                 </div>

                 {/* View Mode Switcher */}
                 <div className="flex items-center gap-1 bg-[#111A16] p-1 rounded-sm border border-[#2A3B33] self-start sm:self-auto">
                   <button
                     type="button"
                     onClick={() => setResultTab('all')}
                     className={`px-3 py-1.5 text-xs font-sans tracking-wider uppercase rounded-xs transition-all flex items-center gap-1.5 ${
                       resultTab === 'all'
                         ? 'bg-[#A3B8AD] text-[#0F1412] font-medium'
                         : 'text-gray-400 hover:text-gray-200'
                     }`}
                   >
                     <Layers className="w-3.5 h-3.5" />
                     <span>Полный вид</span>
                   </button>

                   <button
                     type="button"
                     onClick={() => setResultTab('timeline')}
                     className={`px-3 py-1.5 text-xs font-sans tracking-wider uppercase rounded-xs transition-all flex items-center gap-1.5 ${
                       resultTab === 'timeline'
                         ? 'bg-[#A3B8AD] text-[#0F1412] font-medium'
                         : 'text-gray-400 hover:text-gray-200'
                     }`}
                   >
                     <Clock className="w-3.5 h-3.5" />
                     <span>Шкала времени</span>
                   </button>

                   <button
                     type="button"
                     onClick={() => setResultTab('story')}
                     className={`px-3 py-1.5 text-xs font-sans tracking-wider uppercase rounded-xs transition-all flex items-center gap-1.5 ${
                       resultTab === 'story'
                         ? 'bg-[#A3B8AD] text-[#0F1412] font-medium'
                         : 'text-gray-400 hover:text-gray-200'
                     }`}
                   >
                     <BookOpen className="w-3.5 h-3.5" />
                     <span>Сказка</span>
                   </button>

                   <button
                     type="button"
                     onClick={() => setResultTab('mirror')}
                     className={`px-3 py-1.5 text-xs font-sans tracking-wider uppercase rounded-xs transition-all flex items-center gap-1.5 ${
                       resultTab === 'mirror'
                         ? 'bg-[#A3B8AD] text-[#0F1412] font-medium'
                         : 'text-gray-400 hover:text-gray-200'
                     }`}
                   >
                     <Sparkles className="w-3.5 h-3.5" />
                     <span>Зеркало</span>
                   </button>
                 </div>
              </div>

              {/* TIMELINE SECTION (Visible when in 'all' or 'timeline') */}
              {(resultTab === 'all' || resultTab === 'timeline') && (
                <MythTimeline inputs={inputs} result={result} mode="result" />
              )}

              {/* BLOCK 1: STORY (Visible when in 'all' or 'story') */}
              {(resultTab === 'all' || resultTab === 'story') && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 mb-6 opacity-80">
                    <BookOpen className="w-4 h-4 text-[#A3B8AD]" />
                    <span className="text-xs tracking-widest uppercase text-[#A3B8AD]">Текст сказки-метафоры</span>
                  </div>
                  <div className="font-serif text-lg md:text-xl leading-loose text-gray-300 space-y-6">
                    {result.story.split('\n\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                  {resultTab === 'all' && <hr className="border-[#2A3B33] my-8" />}
                </div>
              )}

              {/* BLOCK 2: MIRROR (Visible when in 'all' or 'mirror') */}
              {(resultTab === 'all' || resultTab === 'mirror') && (
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
              )}

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

              {/* Tester Feedback Widget */}
              <TesterFeedbackWidget />

              {/* Meeting of Mirrors & Full Profile CTA */}
              <div className="mt-12 text-center border p-8 border-[#2A3B33] bg-[#111A16]">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A2621] border border-[#2A3B33] text-[#A3B8AD] text-[10px] tracking-widest uppercase mb-3">
                  <GitFork size={12} className="text-[#C8A45D]" />
                  <span>Следующий шаг исследования</span>
                </div>
                <h3 className="font-serif text-2xl text-[#EAEAEA] mb-3">Встреча двух зеркал</h3>
                <p className="text-xs sm:text-sm text-gray-400 mb-6 max-w-md mx-auto leading-relaxed">
                  {hasCodeResult 
                    ? 'Ваш Цифровой Код уже рассчитан! Вы можете сопоставить образный миф со структурой вашей даты прямо сейчас.'
                    : 'Сопоставьте эту образную историю с числовой матрицей вашей даты рождения, чтобы увидеть параллели и различия.'}
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  {onNavigateToMeeting && (
                    <button 
                      onClick={onNavigateToMeeting}
                      className="px-8 py-4 bg-[#A3B8AD] text-[#0F1412] tracking-[0.2em] font-sans uppercase text-xs font-semibold hover:bg-[#8CA296] transition-all flex items-center justify-center gap-2"
                    >
                      <GitFork size={15} />
                      <span>{hasCodeResult ? 'Провести Встречу Зеркал' : 'Рассчитать Код и Сопоставить'}</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setShowLeadForm(true)}
                    className="px-6 py-4 bg-transparent border border-[#2A3B33] text-[#A3B8AD] tracking-[0.15em] font-sans uppercase text-xs hover:text-[#EAEAEA] hover:border-[#A3B8AD] hover:bg-[#1A2621] transition-all"
                  >
                    Большое исследование
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
      <LeadModal 
        isOpen={showLeadForm} 
        onClose={() => setShowLeadForm(false)} 
        source="personal_myth_big_research" 
        theme="dark" 
      />
    </div>
  );
}
