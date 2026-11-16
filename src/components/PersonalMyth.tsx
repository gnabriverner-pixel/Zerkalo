import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ArrowRight, ChevronLeft, RotateCcw } from 'lucide-react';
import { ApiResponse, StoryInputs } from '../types';
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
  // 0 = Intro, 1-4 = questions, 5 = generating, 6 = result
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<StoryInputs>({ q1: '', q2: '', q3: '', q4: '' });
  const [result, setResult] = useState<ApiResponse['story_result'] | null>(null);
  const [errorText, setErrorText] = useState('');
  const [journalNote, setJournalNote] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  const stepMeta = [
    {
      id: 'q1',
      tag: 'Дыхание 01 / 04 · Точка ожидания',
      orbNumber: 4,
      title: 'Где сейчас вашему внутреннему пространству стало тесно или недостаёт воздуха?',
      placeholder: 'Опишите ощущением: развилка на дороге, тихое ожидание перед рассветом, запертое окно...'
    },
    {
      id: 'q2',
      tag: 'Дыхание 02 / 04 · Живой образ',
      orbNumber: 8,
      title: 'Если бы ваше сегодняшнее состояние было пейзажем или образом — что вы видите?',
      placeholder: 'Туман над утренним океаном, высокий маяк на скале, сад под первым снегом...'
    },
    {
      id: 'q3',
      tag: 'Дыхание 03 / 04 · Мгновение полёта',
      orbNumber: 5,
      title: 'Вспомните мгновение, когда вы чувствовали в себе крылья, лёгкость и живую радость.',
      placeholder: 'Утренний свет, быстрая дорога, глубокий разговор, тишина у воды...'
    },
    {
      id: 'q4',
      tag: 'Дыхание 04 / 04 · Горизонт мечты',
      orbNumber: 6,
      title: 'Какое состояние или простор вы больше всего хотите впустить в свою жизнь сейчас?',
      placeholder: 'Свободу полёта, ясную тишину, смелость мечтать, сердечное тепло...'
    }
  ];

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleGenerate();
    }
  };

  const applyFallback = () => {
    const fallbackStoryResult: NonNullable<ApiResponse['story_result']> = {
      title: 'Песня открытого горизонта',
      story: `В пространстве, где ощущалось ${inputs.q1 || 'тихое ожидание перед рассветом'}, долго стоял знакомый образ: ${inputs.q2 || 'высокий берег над утренним морем'}. Казалось, что само небо прислушивается к этой тишине и ждёт первого движения.\n\nНо стоило внутри проснуться памяти о настоящем полёте — ${inputs.q3 || 'чистому утреннему свету и свободному дыханию'} — как горизонт мягко расступился. Пришло то самое созвучие, которого так ждало сердце: ${inputs.q4 || 'простор, лёгкость и ясная внутренняя свобода'}. И тогда ветер сам наполнил паруса.`,
      mirror: {
        mainImage: inputs.q2 || 'Высокий берег над утренним морем',
        innerTension: inputs.q1 || 'Точка перед новым взлётом',
        hiddenResource: inputs.q4 || 'Спокойный простор и ясность',
        newView: inputs.q3 || 'Память о собственных крыльях'
      },
      meaning: [
        'Любое ощущение тесноты говорит лишь о том, что ваши крылья выросли для большего неба.',
        'Точка вашей живой радости всегда остаётся внутри вас как надёжный компас.'
      ],
      one_step: 'Подарите себе сегодня одно свободное решение из чувства простора и радости, а не спешки.',
      journal_question: 'Куда полетят мои мысли и мечты, если я прямо сейчас разрешу себе дышать полной грудью?',
      disclaimer: 'Художественно-рефлексивный формат самопознания.'
    };
    setResult(fallbackStoryResult);
    if (onMythCompleted) {
      onMythCompleted(inputs, fallbackStoryResult);
    }
    setStep(6);
  };

  const handleGenerate = async () => {
    setStep(5);
    setErrorText('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'story', storyInputs: inputs })
      });
      
      const data: ApiResponse = await res.json();

      if (data.status === 'crisis') {
        setErrorText(data.ui?.safe_message || "Мы не можем сформировать историю по текущему запросу.");
        setStep(4);
      } else if (data.status === 'demo') {
        applyFallback();
      } else if (data.status === 'error' || !data.story_result) {
        setErrorText(data.ui?.safe_message || "Связь с зеркалом прервалась. Попробуйте обновить.");
        setStep(4);
      } else {
        setResult(data.story_result);
        if (onMythCompleted) {
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
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
    }
  }, [step]);

  const currentQuestion = step >= 1 && step <= 4 ? stepMeta[step - 1] : null;
  const currentInputValue = currentQuestion ? inputs[currentQuestion.id as keyof StoryInputs] : '';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-20 sm:py-28 px-6 sm:px-10 text-[var(--color-text-primary)] font-sans relative overflow-x-hidden w-full">
      
      <div className="w-full max-w-3xl flex flex-col items-center relative z-10 my-auto">

        <AnimatePresence mode="wait">
          
          {/* STEP 0: BREATHING INTRO SCREEN */}
          {step === 0 && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.9 }}
              className="text-center w-full max-w-2xl mx-auto py-8 space-y-10"
            >
              <div className="flex justify-center mb-4 animate-float-gentle">
                <Orb number={7} size={185} glow={true} />
              </div>

              <div className="space-y-5">
                <span className="text-[11px] uppercase tracking-[0.42em] text-[#7CE8EE] font-mono block opacity-85">
                  Орбита I · Голос Воображения и Свободы
                </span>

                <h1 className="font-serif text-5xl sm:text-7xl text-[var(--color-text-primary)] font-light tracking-tight leading-tight">
                  Личный Миф
                </h1>

                <p className="font-serif text-xl sm:text-2xl text-[var(--color-text-secondary)] leading-[1.8] max-w-xl mx-auto font-light pt-2">
                  Четыре вопроса-образа в открытом пространстве тишины. Без дат и расчётов ваши собственные метафоры сложатся в светлую сказку о том, где живут ваши крылья.
                </p>
              </div>
              
              <div className="pt-4">
                <button 
                  onClick={() => setStep(1)}
                  className="px-10 py-4 border border-[var(--color-antique-gold)]/45 bg-[var(--color-antique-gold)]/[0.08] hover:bg-[var(--color-antique-gold)]/[0.18] text-[var(--color-antique-gold)] uppercase tracking-[0.28em] text-[11px] font-mono rounded-full transition-all cursor-pointer inline-flex items-center gap-3"
                >
                  <span>Войти в пространство образов</span>
                  <ArrowRight size={14} />
                </button>
              </div>
              
              <div className="pt-10 text-xs text-[var(--color-text-muted)] font-light tracking-wide flex items-center justify-center gap-3">
                 <span>Свободный художественный поток самопознания</span>
                 {onOpenAbout && (
                   <button
                     type="button"
                     onClick={onOpenAbout}
                     className="text-[var(--color-antique-gold)] hover:underline cursor-pointer"
                   >
                     О методе
                   </button>
                 )}
              </div>
            </motion.div>
          )}

          {/* STEPS 1 TO 4: ONE BREATHABLE QUESTION PER SCREEN */}
          {step >= 1 && step <= 4 && currentQuestion && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.7 }}
              className="w-full flex flex-col items-center text-center max-w-2xl mx-auto py-8 space-y-12"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-antique-gold)] font-mono">
                  {currentQuestion.tag}
                </span>

                {step > 1 ? (
                  <button 
                    onClick={() => setStep(step - 1)} 
                    className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] hover:text-white flex items-center gap-1 transition-colors cursor-pointer font-mono"
                  >
                    <ChevronLeft size={14} />
                    <span>Назад</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => setStep(0)} 
                    className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer font-mono"
                  >
                    В начало
                  </button>
                )}
              </div>

              <div className="py-2 animate-float-gentle">
                <Orb number={currentQuestion.orbNumber} size={130} glow={true} />
              </div>

              <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-text-primary)] leading-[1.35] font-light max-w-2xl">
                {currentQuestion.title}
              </h2>
              
              <div className="relative w-full">
                <textarea 
                  autoFocus
                  rows={3}
                  className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[var(--color-antique-gold)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/55 text-xl sm:text-2xl font-serif text-center py-4 px-2 outline-none transition-all duration-300 resize-none leading-[1.7]"
                  placeholder={currentQuestion.placeholder}
                  value={currentInputValue}
                  onChange={(e) => setInputs({ ...inputs, [currentQuestion.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && currentInputValue.trim().length >= 3) {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                />
              </div>
              
              {errorText && (
                <div className="text-xs text-amber-300 max-w-md font-light">
                  {errorText}
                </div>
              )}

              <div className="flex flex-col items-center gap-4 pt-2">
                <button 
                  onClick={handleNext}
                  disabled={currentInputValue.trim().length < 3}
                  className="px-10 py-4 border border-[var(--color-antique-gold)]/45 bg-[var(--color-antique-gold)]/[0.08] hover:bg-[var(--color-antique-gold)]/[0.18] text-[var(--color-antique-gold)] rounded-full uppercase tracking-[0.28em] text-[11px] font-mono transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-3 cursor-pointer"
                >
                  <span>{step === 4 ? 'Сплести сказку' : 'Следующее дыхание'}</span>
                  <ArrowRight size={14} />
                </button>
                
                <span className="text-[11px] text-[var(--color-text-muted)] font-light">
                  {step === 4 ? 'Нажмите Enter для рождения сказки' : 'Нажмите Enter для продолжения'}
                </span>
              </div>

            </motion.div>
          )}

          {/* STEP 5: GENERATING STATE */}
          {step === 5 && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center justify-center py-28 text-center max-w-lg mx-auto space-y-6"
            >
              <Orb number={7} size={160} glow={true} />
              <Loader2 className="w-5 h-5 text-[var(--color-antique-gold)] animate-spin" />
              <h3 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light">
                Рождается ваша история...
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] font-light max-w-sm leading-relaxed">
                Четыре ваших образа соединяются в единую метафору простора и надежды.
              </p>
            </motion.div>
          )}

          {/* STEP 6: SPACIOUS LITERARY RESULT SCREEN (NO HEAVY BOXES) */}
          {step === 6 && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 }}
              ref={resultRef}
              className="w-full flex flex-col items-center text-center py-8 space-y-24 sm:space-y-32"
            >
              {/* Header Title */}
              <div className="w-full max-w-2xl mx-auto space-y-6">
                <Orb number={7} size={90} glow={true} className="mx-auto" />
                
                <span className="text-[10px] tracking-[0.38em] uppercase text-[#7CE8EE] font-mono block">
                  Личный Миф · Ваша Живая Притча
                </span>
                
                <h1 className="font-serif text-4xl sm:text-6xl text-[var(--color-text-primary)] font-light tracking-tight leading-tight">
                  {result.title}
                </h1>

                {/* Subtle Ribbon of the 4 Source Metaphors */}
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-text-muted)] font-light pt-2">
                  Из ваших образов: «{inputs.q1}» · «{inputs.q2}» · «{inputs.q3}» · «{inputs.q4}»
                </p>
              </div>

              {/* PURE LITERARY STORY IN OPEN SPACE */}
              <div className="w-full max-w-2xl mx-auto pt-12 border-t border-white/[0.08] text-left">
                <div className="font-serif text-2xl sm:text-[26px] leading-[1.95] text-[#F7F4ED] space-y-10 font-light">
                  {result.story.split('\n\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {/* LIVING QUESTION FOR REFLECTION */}
              <div className="w-full max-w-xl mx-auto pt-16 border-t border-white/[0.08] text-center space-y-6">
                <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[var(--color-antique-gold)] block">
                  Горизонт для размышления
                </span>
                
                <p className="font-serif italic text-2xl sm:text-3xl text-[#EAE4D7] font-light leading-[1.75]">
                  «{result.journal_question || "Куда полетят мои мысли и мечты, если я прямо сейчас разрешу себе дышать полной грудью?"}»
                </p>

                <textarea 
                  rows={2}
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  placeholder="Запишите здесь свой отклик или мечту..."
                  className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[var(--color-antique-gold)] text-base font-serif text-center py-3 outline-none transition-colors text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/60 font-light resize-none block"
                />
              </div>

              {/* BRIDGE TO SECOND ORBIT / MEETING */}
              <div className="w-full max-w-2xl mx-auto pt-16 border-t border-white/[0.08] text-center space-y-8">
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[#7CE8EE] block">
                    Гармония двух орбит
                  </span>
                  <h3 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light">
                    {hasCodeResult ? 'Готовы к Встрече Зеркал?' : 'Второе отражение: Космос Даты Рождения'}
                  </h3>
                  <p className="text-base text-[var(--color-text-secondary)] font-light max-w-lg mx-auto leading-[1.85]">
                    {hasCodeResult 
                      ? 'Ваш звёздный атлас даты уже открыт. Соедините обе линзы, чтобы увидеть единую картину вашей природы.'
                      : 'Откройте созвездие своей даты рождения, чтобы соединить живую сказку сегодняшнего дня с вечной мелодией ваших чисел.'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
                  {onNavigateToMeeting && (
                    <button 
                      onClick={onNavigateToMeeting}
                      className="px-9 py-4 border border-[var(--color-antique-gold)]/45 bg-[var(--color-antique-gold)]/[0.08] hover:bg-[var(--color-antique-gold)]/[0.18] text-[var(--color-antique-gold)] uppercase tracking-[0.25em] text-[11px] font-mono rounded-full transition-all flex items-center gap-3 cursor-pointer"
                    >
                      <span>{hasCodeResult ? 'Открыть Встречу Зеркал' : 'Перейти к Космосу Даты'}</span>
                      <ArrowRight size={14} />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setStep(0);
                      setInputs({ q1: '', q2: '', q3: '', q4: '' });
                      setResult(null);
                    }}
                    className="text-[11px] uppercase font-mono tracking-[0.25em] text-[var(--color-text-muted)] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Новая сказка</span>
                  </button>
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}
