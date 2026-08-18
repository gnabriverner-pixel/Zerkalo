import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ArrowRight, ChevronLeft, RotateCcw } from 'lucide-react';
import { StoryInputs, ApiResponse } from '../types';
import { EmblemPlate } from '../art/emblem';
import { Orb } from './Orb';

interface PersonalMythProps {
  initialInputs?: StoryInputs | null;
  initialResult?: ApiResponse['story_result'] | null;
  onOpenAbout?: () => void;
  onMythCompleted?: (inputs: StoryInputs, result: ApiResponse['story_result']) => void;
  onNavigateToMeeting?: () => void;
  hasCodeResult?: boolean;
}

export default function PersonalMyth({ 
  initialInputs,
  initialResult,
  onOpenAbout,
  onMythCompleted,
  onNavigateToMeeting,
  hasCodeResult 
}: PersonalMythProps = {}) {
  const [step, setStep] = useState(initialResult ? 6 : 0);
  const [inputs, setInputs] = useState<StoryInputs>(initialInputs || { q1: '', q2: '', q3: '', q4: '' });
  const [result, setResult] = useState<ApiResponse['story_result'] | null>(initialResult || null);
  const [errorText, setErrorText] = useState('');
  const [journalNote, setJournalNote] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(`myth_${crypto.randomUUID().replace(/-/g, '')}`);

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
      setStep(6);
    }
  }, [initialResult]);

  useEffect(() => {
    if (initialInputs) {
      setInputs(initialInputs);
    }
  }, [initialInputs]);

  const stepMeta = [
    {
      id: 'q1',
      tag: '01 / 04 · Напряжение',
      orbNumber: 4, // Rahu
      title: 'Что сейчас создаёт внутреннее напряжение или неясность?',
      placeholder: 'Опишите не фактами, а ощущением: развилка, тяжесть, застывшее ожидание, фоновый шум...'
    },
    {
      id: 'q2',
      tag: '02 / 04 · Образ состояния',
      orbNumber: 8, // Saturn
      title: 'Если бы это состояние было образом — что это за образ?',
      placeholder: 'Каменный замок без окон, туман над застывшим озером, закрытая дверь, маяк в бурю...'
    },
    {
      id: 'q3',
      tag: '03 / 04 · Точка живости',
      orbNumber: 5, // Mercury
      title: 'Вспомни момент за последнее время, когда ты чувствовал себя по-настоящему живым.',
      placeholder: 'Что там происходило? Утренний свет, холодная вода, открытый разговор, ясность решения...'
    },
    {
      id: 'q4',
      tag: '04 / 04 · Искомое качество',
      orbNumber: 6, // Venus
      title: 'Какое качество или состояние ты сейчас больше всего ищешь?',
      placeholder: 'Тишины, дерзости, мягкости, ясных границ, простора, опоры, тепла...'
    }
  ];

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else if (step === 4) {
      handleGenerate();
    }
  };

  const handleGenerate = async () => {
    setStep(5);
    setErrorText('');
    try {
      const res = await fetch('/api/personal-myth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestIdRef.current,
          consent_version: 'personal-myth-v1.1-rc',
          answers: inputs,
        })
      });
      
      const data: ApiResponse = await res.json();

      if (data.status === 'crisis') {
        setErrorText(data.ui?.safe_message || "Мы не можем сформировать историю по текущему запросу.");
        setStep(4);
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
      setErrorText("Связь с зеркалом прервалась. Попробуйте обновить страницу или отправить запрос снова.");
      setStep(4);
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] py-12 px-4 sm:px-6 lg:px-8 text-[#EAEAEA] font-sans relative overflow-x-hidden w-full selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      
      <div className="w-full max-w-3xl flex flex-col items-center relative z-10 my-auto">

        <AnimatePresence mode="wait">
          
          {step === 0 && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.8 }}
              className="text-center w-full max-w-2xl mx-auto py-8"
            >
              <div className="flex justify-center mb-8">
                <EmblemPlate planet={7} variant="alabaster" size={140} showNumber={false} showLabel={false} />
              </div>

              <span className="text-[11px] uppercase tracking-[0.3em] text-purple-300/80 font-mono block mb-3">
                Независимое зеркало · Личный миф
              </span>

              <h1 className="font-serif text-4xl sm:text-6xl text-stone-100 mb-4 font-normal tracking-tight leading-tight">
                Личный миф
              </h1>

              <p className="text-base sm:text-lg text-stone-300/80 leading-relaxed mb-10 max-w-lg mx-auto font-light">
                Четыре образных вопроса. Никаких анкет и дат рождения — только живая история, рождающаяся из твоих собственных метафор.
              </p>
              
              <button 
                onClick={() => setStep(1)}
                className="px-8 py-4 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] shadow-[0_0_30px_rgba(200,164,93,0.25)] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span>Войти через образы</span>
                <ArrowRight size={14} />
              </button>
              
              <div className="mt-14 text-xs text-stone-400/60 font-light tracking-wide flex items-center justify-center gap-2">
                 <span>Образный формат для внутренней тишины и саморефлексии.</span>
                 {onOpenAbout && (
                   <button type="button" onClick={onOpenAbout} className="text-[var(--color-antique-gold)] hover:underline ml-1">
                     О методе
                   </button>
                 )}
              </div>
            </motion.div>
          )}

          {step >= 1 && step <= 4 && currentQuestion && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.6 }}
              className="w-full flex flex-col items-center text-center max-w-2xl mx-auto py-6"
            >
              <div className="flex items-center justify-between w-full mb-10">
                <span className="text-xs uppercase tracking-[0.25em] text-[var(--color-antique-gold)] font-mono">
                  {currentQuestion.tag}
                </span>

                {step > 1 ? (
                  <button onClick={() => setStep(step - 1)} className="text-xs uppercase tracking-wider text-stone-400 hover:text-stone-200 flex items-center gap-1 transition-colors cursor-pointer">
                    <ChevronLeft size={14} />
                    <span>Назад</span>
                  </button>
                ) : (
                  <button onClick={() => setStep(0)} className="text-xs uppercase tracking-wider text-stone-400 hover:text-stone-200 transition-colors cursor-pointer">
                    Отмена
                  </button>
                )}
              </div>

              <div className="mb-8">
                <EmblemPlate planet={currentQuestion.orbNumber} variant="alabaster" size={100} showNumber={false} showLabel={false} />
              </div>

              <h2 className="font-serif text-2xl sm:text-4xl text-stone-100 mb-10 leading-relaxed font-light max-w-xl">
                {currentQuestion.title}
              </h2>
              
              <div className="relative w-full mb-6">
                <textarea 
                  autoFocus
                  rows={3}
                  value={currentInputValue}
                  onChange={(e) => {
                    setErrorText(null);
                    setInputs({ ...inputs, [currentQuestion.id]: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && currentInputValue.trim().length >= 3) {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  placeholder="Опиши образ несколькими словами или фразой..."
                  className="w-full bg-transparent border-b border-stone-600 focus:border-[var(--color-antique-gold)] px-2 py-3 text-lg sm:text-xl text-stone-100 placeholder:text-stone-600 focus:outline-none transition-colors resize-none font-serif leading-relaxed text-center"
                />
                
                <div className="flex justify-between items-center text-[10px] uppercase font-mono text-stone-500 mt-2 px-1">
                  <span>Минимум 3 символа</span>
                  <span>{currentInputValue.length} знаков</span>
                </div>
              </div>

              {errorText && (
                <div className="w-full max-w-xl mx-auto mb-6 p-4 bg-red-950/40 border border-red-500/30 rounded-xs text-center text-sm text-red-200">
                  <p className="mb-3 text-xs sm:text-sm font-light">{errorText}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorText(null);
                      handleGenerate();
                    }}
                    className="px-4 py-2 bg-red-900/60 hover:bg-red-800 text-xs font-mono uppercase tracking-wider text-red-100 rounded-xs transition-colors cursor-pointer"
                  >
                    Попробовать снова
                  </button>
                </div>
              )}

              <div className="flex flex-col items-center gap-4">
                <button
                  disabled={currentInputValue.trim().length < 3}
                  onClick={handleNext}
                  className={`px-8 py-3.5 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs transition-all flex items-center gap-2 cursor-pointer ${
                    currentInputValue.trim().length >= 3
                      ? 'bg-[var(--color-antique-gold)] text-gray-950 hover:bg-[#D9B770] shadow-[0_0_20px_rgba(200,164,93,0.2)]'
                      : 'bg-white/5 text-stone-600 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  <span>{step === 4 ? 'Соткать историю' : 'Далее'}</span>
                  <ArrowRight size={14} />
                </button>
                <span className="text-[10px] text-stone-500 font-mono">или нажми Enter</span>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center justify-center py-24 text-center max-w-lg mx-auto"
            >
              <EmblemPlate planet={7} variant="alabaster" size={140} showNumber={false} showLabel={false} className="mb-8" />
              <Loader2 className="w-6 h-6 text-[var(--color-antique-gold)] animate-spin mb-6" />
              <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 mb-3 font-light">
                Собираем метафорическую историю...
              </h3>
              <p className="text-xs text-stone-400 font-light max-w-sm leading-relaxed">
                Сказка рождается строго из твоих четырех ответов, без домыслов и шаблонов.
              </p>
            </motion.div>
          )}

          {step === 6 && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              ref={resultRef}
              className="w-full flex flex-col items-center text-left py-6 space-y-12"
            >
              {/* Header Title */}
              <div className="text-center w-full max-w-2xl mx-auto pt-4">
                <EmblemPlate planet={7} variant="alabaster" size={64} showNumber={false} showLabel={false} className="mx-auto mb-6" />
                
                <span className="text-[10px] tracking-[0.3em] uppercase text-purple-300/80 font-mono block mb-3">
                  Личный Миф · Сказка
                </span>
                
                <h1 className="font-serif text-3xl sm:text-5xl text-stone-100 mb-4 font-light tracking-tight">
                  {result.title}
                </h1>
              </div>

              {/* PROVENANCE: Из каких образов родилась история */}
              <div className="w-full bg-[#0D121D]/70 border border-white/[0.08] p-6 sm:p-8 rounded-xs">
                <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)]/80 block mb-4">
                  Символические истоки
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase text-stone-500 font-mono block mb-1">01 · Напряжение</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q1 || '—'}»</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-stone-500 font-mono block mb-1">02 · Образ состояния</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q2 || '—'}»</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-stone-500 font-mono block mb-1">03 · Точка живости</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q3 || '—'}»</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-stone-500 font-mono block mb-1">04 · Искомое качество</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q4 || '—'}»</p>
                  </div>
                </div>
              </div>

              {/* EDITORIAL STORY TEXT (High Leading, Book Chapter) */}
              <article className="w-full bg-[#EFE5D3] border border-[#D1B98D]/50 p-8 sm:p-12 rounded-xs shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
                <div className="mb-8 flex items-center justify-between border-b border-[#7B6545]/20 pb-4 text-[10px] uppercase tracking-[0.25em] text-[#7B6545] font-mono">
                  <span>Личный миф</span>
                  <span>Чернила · твои четыре образа</span>
                </div>
                <div className="font-serif text-lg sm:text-[21px] leading-[2] text-[#282019] space-y-8 font-normal max-w-2xl mx-auto tracking-[0.015em]">
                  {result.story.split('\n\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </article>

              {/* LIVING QUESTION FOR REFLECTION */}
              <div className="w-full bg-[#0D121D]/90 border border-[var(--color-antique-gold)]/20 p-8 sm:p-10 rounded-xs text-center">
                <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-3">
                  Вопрос для внутренней тишины
                </span>
                
                <p className="font-serif italic text-xl sm:text-2xl text-stone-100 mb-6 font-light max-w-xl mx-auto">
                  «{result.journal_question || "Какое крошечное решение из чувства покоя я могу принять прямо сейчас?"}»
                </p>

                <textarea 
                  rows={2}
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  placeholder="Запиши здесь свой отклик или мысль..."
                  className="w-full max-w-xl mx-auto bg-transparent border-0 border-b border-white/20 focus:border-[var(--color-antique-gold)] text-sm text-center py-2 outline-none transition-colors text-stone-100 placeholder:text-stone-600 font-light resize-none block"
                />
              </div>

              {/* CTA TO DIGITAL CODE / MEETING */}
              <div className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-8 sm:p-10 rounded-xs text-center space-y-6">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-2">
                    Следующее зеркало
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-2">
                    {hasCodeResult ? 'Встреча двух зеркал' : 'Цифровой код твоей природы'}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-400 font-light max-w-md mx-auto leading-relaxed">
                    {hasCodeResult 
                      ? 'Твой код уже рассчитан. Можно перейти к синтезу двух независимых отражений.'
                      : 'Открой независимую линзу через дату рождения, чтобы получить пять ключей и сопоставить их с мифом.'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                  {onNavigateToMeeting && (
                    <button 
                      onClick={onNavigateToMeeting}
                      className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>{hasCodeResult ? 'Открыть Встречу зеркал' : 'Открыть Цифровой код'}</span>
                      <ArrowRight size={14} />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setStep(0);
                      setInputs({ q1: '', q2: '', q3: '', q4: '' });
                      setResult(null);
                      requestIdRef.current = `myth_${crypto.randomUUID().replace(/-/g, '')}`;
                    }}
                    className="px-5 py-3 text-xs uppercase tracking-wider text-stone-400 hover:text-stone-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Пройти заново</span>
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
