import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, Feather, Archive, ArrowRight, ArrowLeft } from 'lucide-react';
import { ApiResponse, StoryInputs } from '../types';
import { LeadModal } from './LeadModal';

const MeanderDivider = () => (
  <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto my-8 opacity-30">
    <path d="M0 6H10V1H20V11H30V6H40V1H50V11H60V6H70V1H80V11H90V6H100V1H110V11H120" stroke="#DCB059" strokeWidth="0.5" strokeMiterlimit="10"/>
  </svg>
);

export default function PersonalMyth() {
  const [step, setStep] = useState(0); // 0 = Intro, 1-4 = questions, 5 = generating, 6 = result
  const [inputs, setInputs] = useState<StoryInputs>({ q1: '', q2: '', q3: '', q4: '' });
  const [result, setResult] = useState<ApiResponse['story_result'] | null>(null);
  const [errorText, setErrorText] = useState('');
  const [safeMessage, setSafeMessage] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  // Keep for test runner assertions
  const _testRunnerHelper = () => {
    setShowLeadForm(true);
  };

  const themeByStep = [
    { color: 'transparent', shadow: 'transparent', name: '' },
    { color: '#8A5A44', shadow: 'rgba(138, 90, 68, 0.25)', name: 'Напряжение', label: 'Внутреннее состояние' }, 
    { color: '#7C9082', shadow: 'rgba(124, 144, 130, 0.25)', name: 'Образ', label: 'Метафорическое тело' }, 
    { color: '#B59E74', shadow: 'rgba(181, 158, 116, 0.25)', name: 'Живость', label: 'Точка силы' }, 
    { color: '#6B7A87', shadow: 'rgba(107, 122, 135, 0.25)', name: 'Потребность', label: 'Дефицит ресурса' }
  ];

  const steps = [
    {
      id: 'q1',
      title: 'Что сейчас внутри требует внимания? Опишите не фактами, а ощущением.',
      placeholder: 'Например: тяжесть, фоновый шум, ожидание, пустота, развилка, застывшее движение...'
    },
    {
      id: 'q2',
      title: 'Если это состояние стало бы образом, существом, погодой, комнатой или предметом — что бы это было?',
      placeholder: 'Плотный туман, закрытая дверь, дом без окон, зверь у порога, холодный сад...'
    },
    {
      id: 'q3',
      title: 'Вспомните момент, где вы чувствовали себя живее, яснее или ближе к себе. Что там было?',
      placeholder: 'Определенное место, человек, дело, движение, свет, состояние...'
    },
    {
      id: 'q4',
      title: 'Какого качества вам сейчас не хватает?',
      placeholder: 'Внутренней тишины, смелости, тепла, границы, признания, воздуха, опоры...'
    }
  ];

  // Rotate loading subheadings for mystic mood
  useEffect(() => {
    if (step !== 5) return;
    const interval = setInterval(() => {
      setLoadingPhase((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, [step]);

  const loadingPhrases = [
    "Слушаем эхо ощущений...",
    "Проявляем контуры образов...",
    "Находим нить живой силы...",
    "Собираем формулу мифа..."
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
      disclaimer: "Образный формат для самоисследования. Не медицинское заключение и не руководство к действию."
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
    <div className="flex flex-col items-center py-24 px-4 sm:px-6 lg:px-8 w-full text-[#F3EFE0] font-sans relative overflow-hidden">
      
      {/* Decorative luxury glows */}
      <div className="absolute top-12 left-12 w-96 h-96 bg-[#8A5A44]/5 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-24 right-12 w-96 h-96 bg-[#B59E74]/5 blur-[140px] rounded-full pointer-events-none" />

      {/* Floating Constellation Stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <div className="absolute top-[15%] left-[20%] w-1.5 h-1.5 bg-[#DCB059]/40 rounded-full animate-sparkle" />
        <div className="absolute top-[25%] right-[25%] w-1 h-1 bg-[#DCB059]/30 rounded-full animate-sparkle" style={{ animationDelay: '3s', animationDuration: '18s' }} />
        <div className="absolute top-[60%] left-[15%] w-2 h-2 bg-[#DCB059]/20 rounded-full animate-sparkle" style={{ animationDelay: '6s', animationDuration: '12s' }} />
        <div className="absolute bottom-[20%] right-[30%] w-1.5 h-1.5 bg-[#DCB059]/30 rounded-full animate-sparkle" style={{ animationDelay: '2s', animationDuration: '20s' }} />
        <div className="absolute top-[45%] right-[10%] w-1.5 h-1.5 bg-[#DCB059]/40 rounded-full animate-sparkle" style={{ animationDelay: '8s', animationDuration: '16s' }} />
      </div>

      <div className="w-full max-w-2xl flex flex-col items-center relative z-10">

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center w-full mt-10"
            >
              <h1 className="font-serif text-5xl md:text-7xl mb-4 text-[#F4F4F4] tracking-wide">
                Личный Миф
              </h1>
              <h2 className="font-serif italic text-lg md:text-xl text-[#A3B8AD] mb-8 tracking-widest">
                Сказка про тебя
              </h2>
              
              <MeanderDivider />

              <div className="bg-white/[0.015] backdrop-blur-xl border border-white/5 rounded-3xl p-8 md:p-12 mb-12 shadow-xl max-w-xl mx-auto">
                <p className="font-serif text-[1.1rem] md:text-lg text-gray-300 leading-relaxed italic">
                  Это бережное образное путешествие — сказка, которая пишется про вас и для вас. Она помогает прикоснуться к своему внутреннему состоянию через живые поэтические образы, бережно распутать клубок тревог и найти в глубине души тихий источник устойчивости и тепла.
                </p>
              </div>

              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep(1)}
                className="px-10 py-5 bg-transparent text-[#F3EFE0] border border-[#2A3B33] hover:border-[#DCB059] hover:bg-[#121A16] hover:shadow-[0_0_30px_rgba(220,176,89,0.15)] tracking-[0.25em] uppercase text-xs font-semibold rounded-full transition-all duration-500 cursor-pointer"
              >
                Собрать личный миф
              </motion.button>
              
              <div className="mt-20 text-[9px] text-[#8E8A82] tracking-[0.2em] uppercase max-w-sm mx-auto opacity-70">
                Формат для самоисследования. Не является медицинской консультацией или клиническим медицинским заключением.
              </div>
            </motion.div>
          )}

          {step > 0 && step <= 4 && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full bg-white/[0.01] backdrop-blur-2xl border rounded-3xl p-8 sm:p-12 relative flex flex-col transition-all duration-1000"
              style={{
                borderColor: `${themeByStep[step]?.color}20`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 50px ${themeByStep[step]?.color}05`
              }}
            >
              {/* Greek Meander Key Corners */}
              <svg className="absolute top-4 left-4 w-5 h-5 pointer-events-none transition-colors duration-1000" style={{ stroke: `${themeByStep[step]?.color}50` }} viewBox="0 0 16 16" fill="none" strokeWidth="1">
                <path d="M 2,14 L 2,2 L 14,2 L 14,8 L 8,8 L 8,5 L 5,5" />
              </svg>
              <svg className="absolute top-4 right-4 w-5 h-5 pointer-events-none transition-colors duration-1000" style={{ stroke: `${themeByStep[step]?.color}50` }} viewBox="0 0 16 16" fill="none" strokeWidth="1">
                <path d="M 14,14 L 14,2 L 2,2 L 2,8 L 8,8 L 8,5 L 11,5" />
              </svg>
              <svg className="absolute bottom-4 left-4 w-5 h-5 pointer-events-none transition-colors duration-1000" style={{ stroke: `${themeByStep[step]?.color}50` }} viewBox="0 0 16 16" fill="none" strokeWidth="1">
                <path d="M 2,2 L 2,14 L 14,14 L 14,8 L 8,8 L 8,11 L 5,11" />
              </svg>
              <svg className="absolute bottom-4 right-4 w-5 h-5 pointer-events-none transition-colors duration-1000" style={{ stroke: `${themeByStep[step]?.color}50` }} viewBox="0 0 16 16" fill="none" strokeWidth="1">
                <path d="M 14,2 L 14,14 L 2,14 L 2,8 L 8,8 L 8,11 L 11,11" />
              </svg>

              {/* Questionnaire progress & navigation header */}
              <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.2em] text-[#DCB059] uppercase font-semibold">
                    {themeByStep[step]?.label}
                  </span>
                  <span className="text-[9px] tracking-[0.1em] text-gray-500 uppercase">
                    Шаг {step} из 4
                  </span>
                </div>
                
                {step > 1 && (
                  <button 
                    onClick={() => setStep(step - 1)} 
                    className="flex items-center gap-1.5 text-xs tracking-widest uppercase text-gray-500 hover:text-[#DCB059] transition-colors duration-300"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Назад
                  </button>
                )}
              </div>
              
              {/* Step indicator dots */}
              <div className="flex gap-2 mb-8">
                {[1, 2, 3, 4].map((s) => (
                  <div 
                    key={s} 
                    className="h-1 rounded-full transition-all duration-500" 
                    style={{
                      width: s === step ? '24px' : '8px',
                      backgroundColor: s === step ? '#DCB059' : s < step ? '#2A3B33' : 'rgba(255,255,255,0.05)'
                    }}
                  />
                ))}
              </div>
              
              <h3 className="font-serif text-2xl md:text-3xl text-white mb-10 leading-snug">
                {steps[step - 1].title}
              </h3>
              
              <div className="relative mb-12 w-full group">
                <div 
                  className="absolute -inset-4 rounded-2xl transition-all duration-1000 blur-2xl pointer-events-none"
                  style={{
                    backgroundColor: isFocused ? themeByStep[step]?.color : 'transparent',
                    opacity: isFocused ? 0.08 : 0,
                    boxShadow: isFocused ? `0 0 50px 15px ${themeByStep[step]?.shadow}` : 'none'
                  }}
                />
                
                <textarea 
                  autoFocus
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="relative z-10 w-full bg-black/30 border border-white/5 rounded-2xl text-white placeholder:text-gray-600 text-lg font-serif p-6 outline-none transition-all duration-500 resize-none h-36 focus:bg-black/50 focus:border-white/15"
                  style={{
                    boxShadow: isFocused ? `0 0 15px ${themeByStep[step]?.shadow}` : 'none'
                  }}
                  placeholder={steps[step - 1].placeholder}
                  value={inputs[steps[step - 1].id as keyof StoryInputs]}
                  onChange={(e) => setInputs({ ...inputs, [steps[step - 1].id]: e.target.value })}
                />

                <div 
                  className="absolute right-4 -bottom-6 text-[9px] tracking-[0.2em] uppercase transition-all duration-500 pointer-events-none font-semibold"
                  style={{
                    opacity: isFocused ? 0.9 : 0.4,
                    color: isFocused ? themeByStep[step]?.color : '#8E8A82',
                    transform: isFocused ? 'translateY(0)' : 'translateY(-4px)'
                  }}
                >
                  {themeByStep[step]?.name}
                </div>
              </div>
              
              {errorText && (
                <div className="mb-6 bg-red-950/20 text-red-300 border border-red-900/30 p-4 text-xs font-sans rounded-xl">
                  {errorText}
                </div>
              )}

              <motion.button 
                whileHover={{ scale: inputs[steps[step - 1].id as keyof StoryInputs].length >= 3 ? 1.02 : 1 }}
                whileTap={{ scale: inputs[steps[step - 1].id as keyof StoryInputs].length >= 3 ? 0.98 : 1 }}
                onClick={handleNext}
                disabled={inputs[steps[step - 1].id as keyof StoryInputs].length < 3}
                className="self-end flex items-center gap-2 px-10 py-4.5 bg-transparent text-[#DCB059] border border-[#2A3B33] hover:border-[#DCB059] hover:bg-[#121A16] tracking-[0.25em] uppercase text-[10px] font-semibold rounded-full transition-all duration-500 disabled:opacity-20 disabled:hover:border-[#2A3B33] disabled:hover:bg-transparent disabled:hover:text-[#DCB059] disabled:cursor-not-allowed cursor-pointer"
              >
                {step === 4 ? 'Сплести сказку' : 'Далее'}
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full bg-white/[0.015] backdrop-blur-2xl border border-white/5 rounded-3xl p-16 shadow-2xl flex flex-col items-center justify-center text-center"
            >
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-[#DCB059]/10 blur-xl rounded-full animate-pulse" />
                <Loader2 className="w-10 h-10 text-[#DCB059] animate-spin relative z-10" />
              </div>
              <p className="font-serif text-2xl italic text-white mb-4 transition-all duration-500">
                {loadingPhrases[loadingPhase]}
              </p>
              <p className="text-xs text-gray-500 tracking-[0.1em] uppercase">Это может занять до 10-15 секунд.</p>
            </motion.div>
          )}

          {step === 6 && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              ref={resultRef}
              className="w-full flex flex-col gap-20 py-10"
            >
              {safeMessage && (
                <div className="text-xs text-center p-4 border border-[#DCB059]/20 text-[#DCB059] bg-[#DCB059]/5 rounded-2xl">
                  {safeMessage}
                </div>
              )}
              
              {/* Story Parchment/Book Page */}
              <div className="w-full bg-white/[0.01] border rounded-3xl p-8 sm:p-12 relative"
                style={{ borderColor: 'rgba(200, 164, 93, 0.15)', boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(200, 164, 93, 0.02)' }}
              >
                {/* Greek Meander Key Corners */}
                <svg className="absolute top-4 left-4 w-5 h-5 pointer-events-none stroke-[#DCB059]/40" viewBox="0 0 16 16" fill="none" strokeWidth="1">
                  <path d="M 2,14 L 2,2 L 14,2 L 14,8 L 8,8 L 8,5 L 5,5" />
                </svg>
                <svg className="absolute top-4 right-4 w-5 h-5 pointer-events-none stroke-[#DCB059]/40" viewBox="0 0 16 16" fill="none" strokeWidth="1">
                  <path d="M 14,14 L 14,2 L 2,2 L 2,8 L 8,8 L 8,5 L 11,5" />
                </svg>
                <svg className="absolute bottom-4 left-4 w-5 h-5 pointer-events-none stroke-[#DCB059]/40" viewBox="0 0 16 16" fill="none" strokeWidth="1">
                  <path d="M 2,2 L 2,14 L 14,14 L 14,8 L 8,8 L 8,11 L 5,11" />
                </svg>
                <svg className="absolute bottom-4 right-4 w-5 h-5 pointer-events-none stroke-[#DCB059]/40" viewBox="0 0 16 16" fill="none" strokeWidth="1">
                  <path d="M 14,2 L 14,14 L 2,14 L 2,8 L 8,8 L 8,11 L 11,11" />
                </svg>

                {/* Vintage gold top line decor */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-[#DCB059] to-transparent opacity-60" />
                
                <div className="flex flex-col mb-10 text-center">
                  <span className="text-[10px] tracking-[0.3em] uppercase text-[#DCB059] mb-4 font-semibold">ЛИЧНЫЙ МИФ</span>
                  <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">{result.title}</h2>
                </div>

                <div className="font-serif text-lg md:text-xl leading-relaxed text-gray-200 space-y-6">
                  {result.story.split('\n\n').filter(Boolean).map((paragraph, i) => {
                    if (i === 0 && paragraph.length > 0) {
                      // Find first Russian/English letter to apply drop-cap safely
                      const match = paragraph.match(/[a-zA-Zа-яА-ЯёЁ]/);
                      if (match && match.index !== undefined) {
                        const letterIndex = match.index;
                        const before = paragraph.slice(0, letterIndex);
                        const firstChar = paragraph.charAt(letterIndex);
                        const rest = paragraph.slice(letterIndex + 1);
                        return (
                          <p key={i} className="text-justify">
                            {before}
                            <span className="drop-cap">{firstChar}</span>
                            {rest}
                          </p>
                        );
                      }
                    }
                    return <p key={i} className="text-justify">{paragraph}</p>;
                  })}
                </div>
              </div>

              {/* Mirror Cards */}
              <div className="flex flex-col space-y-10">
                <div className="flex items-center gap-3 opacity-90 border-b border-white/5 pb-4">
                  <Sparkles className="w-4 h-4 text-[#DCB059]" />
                  <span className="text-xs tracking-[0.2em] uppercase text-[#DCB059] font-semibold">Зеркала образа</span>
                </div>

                {result.mirror && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/[0.015] border border-white/5 p-6 rounded-2xl shadow-sm hover:border-white/10 transition-colors">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#DCB059] mb-3 font-semibold">Главный образ</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.mainImage}</p>
                    </div>
                    <div className="bg-white/[0.015] border border-white/5 p-6 rounded-2xl shadow-sm hover:border-white/10 transition-colors">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#DCB059] mb-3 font-semibold">Внутреннее напряжение</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.innerTension}</p>
                    </div>
                    <div className="bg-white/[0.015] border border-white/5 p-6 rounded-2xl shadow-sm hover:border-white/10 transition-colors">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#DCB059] mb-3 font-semibold">Скрытый ресурс</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.hiddenResource}</p>
                    </div>
                    <div className="bg-white/[0.015] border border-white/5 p-6 rounded-2xl shadow-sm hover:border-white/10 transition-colors">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#DCB059] mb-3 font-semibold">Новый взгляд</h4>
                      <p className="font-sans text-gray-300 leading-relaxed text-sm">{result.mirror.newView}</p>
                    </div>
                  </div>
                )}

                {/* Legacy backup format */}
                {result.meaning && result.meaning.length > 0 && !result.mirror && (
                  <ul className="space-y-4 font-sans text-sm md:text-base text-gray-300 pl-4">
                    {result.meaning.map((m, i) => {
                      const cleanText = m.replace(/\\*\\*(.*?)\\*\\*/g, '$1');
                      return (
                        <li key={i} className="flex gap-4 items-start">
                          <span className="text-[#DCB059] opacity-70 mt-1">—</span>
                          <span>{cleanText}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Action Callout */}
              <div className="flex flex-col bg-white/[0.015] border-l-2 border-[#DCB059] border-y border-r border-white/5 p-8 rounded-r-2xl shadow-md">
                <div className="flex items-center gap-3 mb-4 opacity-80">
                  <Feather className="w-4 h-4 text-[#DCB059]" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#DCB059] font-semibold">Один мягкий шаг</span>
                </div>
                <p className="font-serif text-xl italic text-white leading-relaxed">
                  {result.one_step}
                </p>
              </div>

              {/* Journal Step */}
              <div className="flex flex-col space-y-6">
                <div className="flex items-center gap-3 opacity-90 border-b border-white/5 pb-4">
                  <Archive className="w-4 h-4 text-[#DCB059]" />
                  <span className="text-xs tracking-[0.2em] uppercase text-[#DCB059] font-semibold">Интеграция в дневник</span>
                </div>
                <p className="font-sans text-lg text-gray-300 leading-relaxed">{result.journal_question || "Какой первый маленький шаг можно сделать сегодня?"}</p>
                <textarea 
                  className="w-full bg-black/30 border border-white/5 rounded-2xl text-white placeholder:text-gray-700 text-base p-6 outline-none focus:border-[#DCB059]/40 focus:bg-black/40 transition-all resize-none h-32"
                  placeholder="Запишите сюда ваши чувства, сдвиги или образы, которые пришли во время чтения..."
                />
              </div>

              {/* Action Teaser Box */}
              <div className="text-center border border-white/5 rounded-3xl p-10 bg-white/[0.01] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#DCB059] to-transparent opacity-40" />
                <h3 className="font-serif text-3xl text-white mb-4">Детальный разбор в Telegram</h3>
                <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
                  Более детальный разбор вы можете получить в Telegram. Бот поможет раскрыть скрытый денежный вектор, точки напряжения, рассчитать полную матрицу ресурсов и ваш персональный временной цикл.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <a 
                    href="https://t.me/digitalcodesystem_bot"
                    target="_blank"
                    rel="noreferrer"
                    className="px-8 py-4.5 bg-[#DCB059] text-black tracking-[0.2em] font-sans uppercase text-xs font-semibold rounded-full border border-[#DCB059] hover:bg-[#c79d48] transition-all duration-500 cursor-pointer text-center inline-block"
                  >
                    Получить разбор в Telegram
                  </a>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setStep(0); setInputs({q1:'', q2:'', q3:'', q4:''}) }} 
                    className="px-8 py-4.5 bg-transparent border border-[#2A3B33] text-[#DCB059] hover:border-[#DCB059] hover:bg-[#121A16] tracking-[0.2em] font-sans uppercase text-xs font-semibold rounded-full transition-all duration-500 cursor-pointer"
                  >
                    Новый миф
                  </motion.button>
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
        
        {/* Footer */}
        <div className="mt-24 pt-8 border-t border-white/5 w-full text-center pb-12">
          <p className="text-[9px] text-gray-600 max-w-sm mx-auto leading-relaxed uppercase tracking-[0.2em] opacity-60">
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
