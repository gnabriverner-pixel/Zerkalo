import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, BookOpen, Sparkles, Feather, Archive, X, Clock, Compass, Layers, GitFork, ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import { ApiResponse, StoryInputs } from '../types';
import { LeadModal } from './LeadModal';
import { StarMap } from './StarMap';
import { MythTimeline } from './MythTimeline';
import { TesterFeedbackWidget } from './TesterFeedbackWidget';
import { Orb } from './Orb';

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

  const steps = [
    {
      id: 'q1',
      number: '01',
      theme: 'Напряжение',
      title: 'Что сейчас внутри требует внимания? Опишите не фактами, а ощущением.',
      placeholder: 'Например: тяжесть, шум, ожидание, пустота, развилка, застывшее движение...'
    },
    {
      id: 'q2',
      number: '02',
      theme: 'Образ состояния',
      title: 'Если это состояние стало бы образом, существом, погодой, комнатой или предметом — что бы это было?',
      placeholder: 'Туман, закрытая дверь, дом без окон, зверь у порога, холодный сад...'
    },
    {
      id: 'q3',
      number: '03',
      theme: 'Точка живости',
      title: 'Вспомните момент, где вы чувствовали себя живее, яснее или ближе к себе. Что там было?',
      placeholder: 'Место, человек, дело, движение, звук, свет, состояние...'
    },
    {
      id: 'q4',
      number: '04',
      theme: 'Искомое качество',
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
      title: "Отражение в зеркале",
      story: "В тишине между мыслями возникает пространство. То, что казалось неясным напряжением, открывает дорогу к воспоминанию о собственной силе. Когда образ находит свое имя, движение возобновляется само собой.",
      mirror: {
        mainImage: inputs.q2 || "Образ пока не назван",
        innerTension: inputs.q1 || "Состояние пока требует уточнения",
        hiddenResource: inputs.q4 || "Качество, которого сейчас не хватает",
        newView: inputs.q3 || "Точка живости и памяти о себе"
      },
      meaning: [
        "Внимание к внутреннему образу освобождает скрытую энергию.",
        "Качество, которого не хватает, уже знакомо вашей памяти.",
        "Один шаг сегодня важнее тысячи планов на будущее."
      ],
      one_step: "Сделайте сегодня одно простое действие, возвращающее опору: пять минут тишины, глубокий вдох на свежем воздухе или честный разговор с собой.",
      journal_question: "Какое крошечное решение я могу принять прямо сейчас из чувства покоя?",
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
    <div className="flex flex-col items-center py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-cosmic-mesh min-h-screen text-[#EAEAEA] font-sans relative overflow-x-hidden w-full">
      
      {/* Container limits width for reading comfort */}
      <div className="w-full max-w-3xl flex flex-col items-center relative z-10">

        <AnimatePresence mode="wait">
          
          {/* STEP 0: INTRO */}
          {step === 0 && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center w-full mt-4 sm:mt-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#121824] border border-purple-500/30 text-purple-300 text-[11px] tracking-widest uppercase mb-6">
                <Feather size={12} />
                <span>Линза 1 · Символический нарратив</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-6xl mb-4 text-[#F4F4F4] font-normal tracking-tight">
                Личный миф
              </h1>
              <h2 className="font-serif italic text-xl sm:text-2xl text-[var(--color-antique-gold)] mb-6 font-normal">
                Сказка про тебя
              </h2>
              
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-10 max-w-lg mx-auto font-light">
                Четыре образных вопроса. Никакой даты рождения — только персональная художественная история, рождающаяся строго из ваших символов и внутреннего движения.
              </p>
              
              <button 
                onClick={() => setStep(1)}
                className="px-10 py-4 bg-[var(--color-antique-gold)] text-gray-950 rounded-xs uppercase tracking-widest text-xs font-semibold hover:bg-[#D9B770] shadow-[0_0_25px_rgba(200,164,93,0.3)] transition-all cursor-pointer flex items-center gap-2 mx-auto"
              >
                <span>Войти в личный миф</span>
                <ArrowRight size={14} />
              </button>
              
              <div className="mt-12 text-[11px] text-gray-500 tracking-wide uppercase flex flex-col sm:flex-row items-center justify-center gap-2">
                 <span>Образный формат для саморефлексии. Не диагностика и не инструкция к действию.</span>
                 {onOpenAbout && (
                   <button
                     type="button"
                     onClick={onOpenAbout}
                     className="text-[var(--color-antique-gold)] hover:underline transition-colors"
                   >
                     О методе
                   </button>
                 )}
              </div>

              <div className="mt-10">
                <StarMap />
              </div>
            </motion.div>
          )}

          {/* STEPS 1 to 4: QUESTIONS */}
          {step > 0 && step <= 4 && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full flex flex-col glass-card p-6 sm:p-10 rounded-xs border-white/10"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <span className="text-xs tracking-widest text-[var(--color-antique-gold)] uppercase font-mono">
                  Вопрос {step} из 4 · {steps[step - 1].theme}
                </span>
                {step > 1 && (
                   <button 
                     onClick={() => setStep(step - 1)} 
                     className="text-xs uppercase tracking-wider text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                   >
                     <ChevronLeft size={14} />
                     <span>Назад</span>
                   </button>
                )}
              </div>

              {/* Progress Line */}
              <div className="w-full bg-white/5 h-1 mb-8 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-[var(--color-antique-gold)] h-full"
                  initial={{ width: `${((step - 1) / 4) * 100}%` }}
                  animate={{ width: `${(step / 4) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              
              <h3 className="font-serif text-2xl sm:text-3xl text-white mb-6 leading-snug font-normal">
                {steps[step - 1].title}
              </h3>
              
              <div className="relative mb-8 w-full">
                <textarea 
                  autoFocus
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full bg-[#0B0F18] border border-white/15 text-white placeholder:text-gray-600 text-base sm:text-lg font-serif p-5 rounded-xs outline-none transition-all duration-300 resize-none h-36 focus:border-[var(--color-antique-gold)] focus:ring-1 focus:ring-[var(--color-antique-gold)]"
                  placeholder={steps[step - 1].placeholder}
                  value={inputs[steps[step - 1].id as keyof StoryInputs]}
                  onChange={(e) => setInputs({ ...inputs, [steps[step - 1].id]: e.target.value })}
                />
              </div>
              
              {errorText && (
                <div className="mb-6 bg-red-950/40 text-red-300 border border-red-500/30 p-4 text-xs rounded-xs font-sans">
                  {errorText}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <span className="text-xs text-gray-500 font-mono">
                  {inputs[steps[step - 1].id as keyof StoryInputs].length > 0 ? `${inputs[steps[step - 1].id as keyof StoryInputs].length} симв.` : 'минимум 3 символа'}
                </span>

                <button 
                  onClick={handleNext}
                  disabled={inputs[steps[step - 1].id as keyof StoryInputs].length < 3}
                  className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 rounded-xs uppercase tracking-widest text-xs font-semibold hover:bg-[#D9B770] transition-all disabled:opacity-30 disabled:hover:bg-[var(--color-antique-gold)] disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>{step === 4 ? 'Сплести сказку' : 'Далее'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: GENERATING STATE */}
          {step === 5 && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex flex-col items-center justify-center py-20 text-center glass-card p-10 rounded-xs border-white/10"
            >
              <Orb number={7} size="lg" glow={true} className="mb-8" />
              <Loader2 className="w-6 h-6 text-[var(--color-antique-gold)] animate-spin mb-4" />
              <p className="font-serif text-2xl text-white mb-2 font-normal">Вплетаем нити ваших символов в узор...</p>
              <p className="text-xs text-gray-400 font-light max-w-md">Модель DeepSeek V4 формирует независимую художественную сказку строго по вашим 4 ответам.</p>
            </motion.div>
          )}

          {/* STEP 6: RESULT */}
          {step === 6 && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              ref={resultRef}
              className="w-full flex flex-col gap-10 py-6"
            >
              {safeMessage && (
                <div className="text-xs text-center p-3 border border-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] bg-[var(--color-antique-gold)]/5 rounded-xs">
                  {safeMessage}
                </div>
              )}
              
              {/* Title & Central Orb */}
              <div className="glass-card p-8 sm:p-10 rounded-xs border-[var(--color-antique-gold)]/30 text-center relative overflow-hidden">
                <Orb number={7} size="md" glow={true} className="mx-auto mb-4" />
                <span className="text-[10px] tracking-widest uppercase text-purple-300 font-mono block mb-2">
                  Художественное отражение
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-white mb-3 font-normal">
                  {result.title}
                </h2>
              </div>

              {/* SECTION: PROVENANCE (Из каких ваших образов она родилась) */}
              <div className="glass-card p-6 sm:p-8 rounded-xs border-white/10">
                <div className="flex items-center gap-2 mb-4 text-[var(--color-antique-gold)] text-xs uppercase tracking-widest font-semibold">
                  <Compass size={15} />
                  <span>Из каких ваших образов родилась эта сказка</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-[#0B0F18] border border-white/5 rounded-xs">
                    <span className="text-[10px] uppercase text-gray-500 font-mono block mb-1">01. Ощущение / Напряжение:</span>
                    <p className="text-xs text-gray-300 leading-relaxed font-serif italic">«{inputs.q1 || 'не указано'}»</p>
                  </div>
                  <div className="p-3.5 bg-[#0B0F18] border border-white/5 rounded-xs">
                    <span className="text-[10px] uppercase text-gray-500 font-mono block mb-1">02. Центральный образ:</span>
                    <p className="text-xs text-gray-300 leading-relaxed font-serif italic">«{inputs.q2 || 'не указано'}»</p>
                  </div>
                  <div className="p-3.5 bg-[#0B0F18] border border-white/5 rounded-xs">
                    <span className="text-[10px] uppercase text-gray-500 font-mono block mb-1">03. Точка живости:</span>
                    <p className="text-xs text-gray-300 leading-relaxed font-serif italic">«{inputs.q3 || 'не указано'}»</p>
                  </div>
                  <div className="p-3.5 bg-[#0B0F18] border border-white/5 rounded-xs">
                    <span className="text-[10px] uppercase text-gray-500 font-mono block mb-1">04. Искомое качество:</span>
                    <p className="text-xs text-gray-300 leading-relaxed font-serif italic">«{inputs.q4 || 'не указано'}»</p>
                  </div>
                </div>
              </div>

              {/* FULL STORY NARRATIVE */}
              <div className="glass-card p-8 sm:p-12 rounded-xs border-white/10">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <BookOpen className="w-4 h-4 text-[var(--color-antique-gold)]" />
                  <span className="text-xs tracking-widest uppercase text-[var(--color-antique-gold)] font-semibold">
                    Текст сказки-метафоры
                  </span>
                </div>
                
                <div className="font-serif text-lg sm:text-xl leading-relaxed text-gray-200 space-y-6 font-light">
                  {result.story.split('\n\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {/* REFLECTION MIRROR */}
              {result.mirror && (
                <div className="glass-card p-6 sm:p-8 rounded-xs border-white/10 space-y-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-antique-gold)] font-semibold">
                    <Sparkles size={15} />
                    <span>Зеркало смыслов</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-[#0B0F18] border border-white/5 rounded-xs">
                      <h4 className="text-[10px] uppercase tracking-widest text-purple-300 font-mono mb-2">Главный образ</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-xs sm:text-sm">{result.mirror.mainImage}</p>
                    </div>
                    <div className="p-4 bg-[#0B0F18] border border-white/5 rounded-xs">
                      <h4 className="text-[10px] uppercase tracking-widest text-amber-300 font-mono mb-2">Внутреннее напряжение</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-xs sm:text-sm">{result.mirror.innerTension}</p>
                    </div>
                    <div className="p-4 bg-[#0B0F18] border border-white/5 rounded-xs">
                      <h4 className="text-[10px] uppercase tracking-widest text-emerald-300 font-mono mb-2">Скрытый ресурс</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-xs sm:text-sm">{result.mirror.hiddenResource}</p>
                    </div>
                    <div className="p-4 bg-[#0B0F18] border border-white/5 rounded-xs">
                      <h4 className="text-[10px] uppercase tracking-widest text-blue-300 font-mono mb-2">Новый взгляд</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-xs sm:text-sm">{result.mirror.newView}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ONE STEP TODAY */}
              <div className="glass-card p-6 sm:p-8 rounded-xs border-[var(--color-antique-gold)]/30">
                <div className="flex items-center gap-2 mb-3 text-[var(--color-antique-gold)] text-xs uppercase tracking-widest font-semibold">
                  <Feather size={14} />
                  <span>Один шаг сегодня</span>
                </div>
                <p className="font-serif text-xl sm:text-2xl text-white font-light leading-relaxed">
                  {result.one_step}
                </p>
              </div>

              {/* JOURNAL QUESTION */}
              <div className="glass-card p-6 sm:p-8 rounded-xs border-white/10">
                <div className="flex items-center gap-2 mb-3 text-purple-300 text-xs uppercase tracking-widest font-semibold">
                  <Archive size={14} />
                  <span>Вопрос для дневника</span>
                </div>
                <p className="font-serif italic text-lg sm:text-xl text-gray-200 mb-4 font-light">
                  «{result.journal_question || "Какой первый маленький шаг можно сделать сегодня?"}»
                </p>
                <textarea 
                  className="w-full bg-[#080C14] border border-white/15 text-white placeholder:text-gray-600 text-sm p-4 rounded-xs outline-none focus:border-[var(--color-antique-gold)] transition-colors resize-none h-24 font-sans"
                  placeholder="Запишите здесь свои впечатления..."
                />
              </div>

              {/* TESTER FEEDBACK WIDGET */}
              <TesterFeedbackWidget />

              {/* SYNTHESIS / NEXT STEP CTA */}
              <div className="glass-card p-8 sm:p-10 rounded-xs border-[var(--color-antique-gold)]/40 text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121824] border border-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] text-[10px] tracking-widest uppercase mb-2">
                  <GitFork size={12} />
                  <span>Следующий шаг исследования</span>
                </div>
                
                <h3 className="font-serif text-2xl sm:text-3xl text-white">Встреча двух зеркал</h3>
                <p className="text-xs sm:text-sm text-gray-300 mb-6 max-w-md mx-auto leading-relaxed font-light">
                  {hasCodeResult 
                    ? 'Ваш Цифровой Код уже рассчитан! Вы можете провести встречу зеркал прямо сейчас.'
                    : 'Рассчитайте числовой код по вашей дате рождения, чтобы сопоставить структуру с личной сказкой.'}
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                  {onNavigateToMeeting && (
                    <button 
                      onClick={onNavigateToMeeting}
                      className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 tracking-widest uppercase text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <GitFork size={15} />
                      <span>{hasCodeResult ? 'Провести Встречу Зеркал' : 'Рассчитать Код и Сопоставить'}</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setShowLeadForm(true)}
                    className="px-6 py-3.5 border border-white/20 text-gray-300 tracking-widest uppercase text-xs rounded-xs hover:border-white/40 hover:text-white transition-all"
                  >
                    Большое исследование
                  </button>
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
        
        {/* Safety Disclaimer */}
        <div className="mt-16 pt-8 border-t border-white/5 w-full text-center pb-8">
          <p className="text-[10px] text-gray-500 max-w-md mx-auto leading-relaxed uppercase tracking-wider font-mono">
            Это образная история для саморефлексии. Не является руководством к действию или единственно верным прочтением.
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
