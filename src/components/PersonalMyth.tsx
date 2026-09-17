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
      tag: '01 / 04 · Ситуация',
      orbNumber: 4, // Rahu
      title: 'В какой ситуации тебе сейчас хочется лучше понять себя?',
      placeholder: 'Опиши один эпизод: что происходит, что ты делаешь и что остаётся неясным. Если трудности нет — что хочется исследовать?'
    },
    {
      id: 'q2',
      tag: '02 / 04 · Образ состояния',
      orbNumber: 8, // Saturn
      title: 'Какой предмет, место или образ точнее всего передаёт это состояние?',
      placeholder: 'Подойдёт обычная вещь. Образ не приходит — так и напиши; выдумывать красивую метафору не нужно.'
    },
    {
      id: 'q3',
      tag: '03 / 04 · Точка живости',
      orbNumber: 5, // Mercury
      title: 'Когда за последнее время ты почувствовал: «вот здесь я на своём месте»?',
      placeholder: 'Что ты делал и что в этом было живым: движение, внимание, общение? Достаточно одного небольшого эпизода. Если не вспоминается — так и напиши.'
    },
    {
      id: 'q4',
      tag: '04 / 04 · Искомое качество',
      orbNumber: 6, // Venus
      title: 'Чего тебе хочется больше в этой ситуации?',
      placeholder: 'Назови качество или состояние своими словами. Не правильный ответ, а то, чего действительно ищешь.'
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

              <span className="text-[13px] uppercase tracking-[0.3em] text-purple-300/80 font-mono block mb-3">
                Независимое зеркало · Личный миф
              </span>

              <h1 className="font-serif text-4xl sm:text-6xl text-stone-100 mb-4 font-normal tracking-tight leading-tight">
                Личный миф
              </h1>

              <p className="text-base sm:text-lg text-stone-300/80 leading-relaxed mb-10 max-w-lg mx-auto font-normal">
                Четыре образных вопроса. Никаких анкет и дат рождения — только живая история, рождающаяся из твоих собственных метафор.
              </p>
              
              <button 
                onClick={() => setStep(1)}
                className="px-8 py-4 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] shadow-[0_0_30px_rgba(200,164,93,0.25)] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span>Войти через образы</span>
                <ArrowRight size={14} />
              </button>
              
              <div className="mt-14 text-xs text-stone-400/60 font-normal tracking-wide flex items-center justify-center gap-2">
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
                  placeholder={currentQuestion.placeholder}
                  className="w-full bg-transparent border-b border-stone-600 focus:border-[var(--color-antique-gold)] px-2 py-3 text-lg sm:text-xl text-stone-100 placeholder:text-stone-600 focus:outline-none transition-colors resize-none font-serif leading-relaxed text-center"
                />
                
                <div className="flex justify-between items-center text-[13px] uppercase font-mono text-stone-400 mt-2 px-1">
                  <span>Минимум 3 символа</span>
                  <span>{currentInputValue.length} знаков</span>
                </div>
              </div>

              {errorText && (
                <div className="w-full max-w-xl mx-auto mb-6 p-4 bg-red-950/40 border border-red-500/30 rounded-xs text-center text-sm text-red-200">
                  <p className="mb-3 text-xs sm:text-sm font-normal">{errorText}</p>
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
                <span className="text-[13px] text-stone-400 font-mono">или нажми Enter</span>
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
              <p className="text-xs text-stone-400 font-normal max-w-sm leading-relaxed">
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
                
                <span className="text-[13px] tracking-[0.3em] uppercase text-purple-300/80 font-mono block mb-2">
                  Личный Миф · Художественная сцена
                </span>
                <p className="text-xs text-stone-400 font-normal mb-4">
                  Дальше — художественная сцена. Её герой — ты.
                </p>
                
                <h1 className="font-serif text-3xl sm:text-5xl text-stone-100 mb-4 font-light tracking-tight">
                  {result.title}
                </h1>
              </div>

              {/* PROVENANCE: Из каких образов родилась история */}
              <div className="w-full bg-[#0D121D]/70 border border-white/[0.08] p-6 sm:p-8 rounded-xs">
                <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)]/80 block mb-4">
                  Символические истоки
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[13px] uppercase text-stone-400 font-mono block mb-1">01 · Ситуация</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q1 || '—'}»</p>
                  </div>
                  <div>
                    <span className="text-[13px] uppercase text-stone-400 font-mono block mb-1">02 · Образ состояния</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q2 || '—'}»</p>
                  </div>
                  <div>
                    <span className="text-[13px] uppercase text-stone-400 font-mono block mb-1">03 · Точка живости</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q3 || '—'}»</p>
                  </div>
                  <div>
                    <span className="text-[13px] uppercase text-stone-400 font-mono block mb-1">04 · Искомое качество</span>
                    <p className="text-xs text-stone-300 font-serif italic">«{inputs.q4 || '—'}»</p>
                  </div>
                </div>
              </div>

              {/* EDITORIAL STORY TEXT (High Leading, Book Chapter) */}
              <article className="w-full bg-[#EFE5D3] border border-[#D1B98D]/50 p-8 sm:p-12 rounded-xs shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
                <div className="mb-8 flex items-center justify-between border-b border-[#7B6545]/20 pb-4 text-[13px] uppercase tracking-[0.25em] text-[#7B6545] font-mono">
                  <span>Личный миф</span>
                  <span>Чернила · твои четыре образа</span>
                </div>
                <div className="font-serif text-lg sm:text-[21px] leading-[2] text-[#282019] space-y-8 font-normal max-w-2xl mx-auto tracking-[0.015em]">
                  {result.story.split('\n\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </article>

              <div className="w-full max-w-2xl mx-auto rounded-xs border border-purple-300/15 bg-purple-300/[0.04] p-6 sm:p-7">
                <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-purple-200/80 block mb-3">
                  Что стало возможным
                </span>
                <p className="font-serif text-lg text-stone-200 leading-relaxed">
                  {result.mirror.hiddenResource}
                </p>
              </div>

              <p className="max-w-2xl mx-auto text-sm text-stone-400 leading-relaxed text-center">
                У этой истории нет единственно правильной расшифровки. Можно взять одну деталь, изменить её или решить, что образ вам не подходит — смысл остаётся за вами.
              </p>

              {/* LIVING QUESTION FOR REFLECTION */}
              <div className="w-full bg-[#0D121D]/90 border border-[var(--color-antique-gold)]/20 p-8 sm:p-10 rounded-xs text-center">
                <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-3">
                  Вопрос для внутренней тишины
                </span>
                
                <p className="font-serif italic text-xl sm:text-2xl text-stone-100 mb-6 font-normal max-w-xl mx-auto">
                  «{result.journal_question || "Какое крошечное решение из чувства покоя я могу принять прямо сейчас?"}»
                </p>

                <textarea 
                  rows={2}
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  placeholder="Запиши здесь свой отклик или мысль..."
                  className="w-full max-w-xl mx-auto bg-transparent border-0 border-b border-white/20 focus:border-[var(--color-antique-gold)] text-sm text-center py-2 outline-none transition-colors text-stone-100 placeholder:text-stone-600 font-normal resize-none block"
                />
              </div>

              {/* CTA TO DIGITAL CODE / MEETING */}
              <div className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-8 sm:p-10 rounded-xs text-center space-y-6">
                <div>
                  <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-2">
                    Следующее зеркало
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-2">
                    {hasCodeResult ? 'Встреча двух зеркал' : 'Цифровой код твоей природы'}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-400 font-normal max-w-md mx-auto leading-relaxed">
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
