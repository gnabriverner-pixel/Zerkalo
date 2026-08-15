import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  GitFork, 
  Send, 
  RefreshCw, 
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse, MeetingOfMirrorsResult, MeetingApiResponse } from '../types';
import { Orb } from './Orb';
import { AlbertDialogue } from './AlbertDialogue';

interface MeetingOfMirrorsProps {
  codeResult: CalculationResult | null;
  firstMirror: FirstMirror | null;
  storyInputs: StoryInputs | null;
  storyResult: ApiResponse['story_result'] | null;
  onOpenCode: () => void;
  onOpenMyth: () => void;
}

export function MeetingOfMirrors({
  codeResult,
  firstMirror,
  storyInputs,
  storyResult,
  onOpenCode,
  onOpenMyth
}: MeetingOfMirrorsProps) {
  const [meetingResult, setMeetingResult] = useState<MeetingOfMirrorsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAlbertOpen, setIsAlbertOpen] = useState(false);
  const [albertTopic, setAlbertTopic] = useState('');
  const [userNote, setUserNote] = useState('');

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult && !!storyInputs;
  const isReadyForSynthesis = hasCode && hasMyth;

  const handleRunSynthesis = async () => {
    if (!isReadyForSynthesis) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/lab/meeting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeData: {
            calc: codeResult,
            firstMirror: firstMirror || undefined
          },
          storyData: {
            storyInputs,
            storyResult
          }
        })
      });

      const data: MeetingApiResponse = await response.json();

      if (data.status === 'ok' && data.result) {
        setMeetingResult(data.result);
      } else {
        setErrorMessage(data.ui?.safe_message || 'Не удалось сформировать встречу зеркал. Попробуйте еще раз.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Связь с зеркалом прервалась при сопоставлении линз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] py-12 px-4 sm:px-6 lg:px-8 text-[#EAEAEA] font-sans relative overflow-x-hidden w-full selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      
      <div className="w-full max-w-4xl flex flex-col items-center relative z-10 my-auto">
        
        {/* ========================================================= */}
        {/* VISUAL CENTER: TWO CONVERGING ORBS */}
        {/* ========================================================= */}
        <div className="flex flex-col items-center text-center mb-12">
          
          <div className="flex items-center justify-center -space-x-4 sm:-space-x-6 mb-8 relative">
            <motion.div
              initial={{ x: -25, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.9 }}
              className="relative z-10"
            >
              <Orb number={codeResult?.soul || 1} size="lg" glow={true} />
            </motion.div>

            <motion.div
              initial={{ x: 25, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.9 }}
              className="relative z-20"
            >
              <Orb number={7} size="lg" glow={true} />
            </motion.div>
          </div>

          <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-antique-gold)] font-mono block mb-3">
            Синтез · Встреча Зеркал
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl text-stone-100 mb-4 font-light tracking-tight leading-tight">
            Встреча двух отражений
          </h1>

          {/* Central Architectural Frame */}
          <div className="w-full max-w-2xl bg-[#0D121D]/80 border border-white/[0.08] p-6 sm:p-8 rounded-xs mt-4">
            <p className="font-serif italic text-base sm:text-lg text-[#C9C0AE] leading-relaxed font-light">
              «Эти две версии появились независимо. Одна — из даты. Другая — из ваших образов. Совпадения ничего не доказывают, но дают повод присмотреться к себе.»
            </p>
          </div>

        </div>

        {/* ========================================================= */}
        {/* STATUS OF INITIAL MIRRORS */}
        {/* ========================================================= */}
        <div className="w-full bg-[#0D121D]/60 border border-white/[0.06] p-6 sm:p-8 mb-10 rounded-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Mirror 1: Digital Code */}
            <div className={`p-5 rounded-xs border transition-all ${
              hasCode ? 'bg-[#101726]/80 border-[var(--color-antique-gold)]/40' : 'bg-[#0B0F18]/50 border-white/[0.04] opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-antique-gold)] font-mono">
                  Линза I · Цифровой Код
                </span>
                {hasCode ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-light">
                    <CheckCircle2 size={14} /> Рассчитан
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-500 uppercase font-mono">Не рассчитан</span>
                )}
              </div>

              {hasCode ? (
                <div className="flex items-center gap-3">
                  <Orb number={codeResult.soul} size="xs" glow={false} />
                  <div>
                    <div className="font-serif text-lg text-stone-100">
                      Душа {codeResult.soul} · Путь {codeResult.path}
                    </div>
                    <div className="text-xs text-stone-400 font-mono">
                      Выражение {codeResult.expression}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-400 flex flex-col items-start gap-2">
                  <span>Введите дату рождения для формирования первой линзы.</span>
                  <button 
                    onClick={onOpenCode}
                    className="text-[11px] text-[var(--color-antique-gold)] hover:underline uppercase tracking-wider flex items-center gap-1 font-medium"
                  >
                    Перейти к коду <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Mirror 2: Personal Myth */}
            <div className={`p-5 rounded-xs border transition-all ${
              hasMyth ? 'bg-[#101726]/80 border-purple-500/40' : 'bg-[#0B0F18]/50 border-white/[0.04] opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-widest text-purple-300 font-mono">
                  Линза II · Личный Миф
                </span>
                {hasMyth ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-light">
                    <CheckCircle2 size={14} /> Создан
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-500 uppercase font-mono">Не пройден</span>
                )}
              </div>

              {hasMyth ? (
                <div className="flex items-center gap-3">
                  <Orb number={7} size="xs" glow={false} />
                  <div>
                    <div className="font-serif text-lg text-stone-100 italic">
                      «{storyResult.title}»
                    </div>
                    <div className="text-xs text-stone-400 font-mono truncate max-w-[200px]">
                      Образ: {storyInputs.q2 || 'не назван'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-400 flex flex-col items-start gap-2">
                  <span>Ответьте на 4 образных вопроса для создания сказки.</span>
                  <button 
                    onClick={onOpenMyth}
                    className="text-[11px] text-purple-300 hover:underline uppercase tracking-wider flex items-center gap-1 font-medium"
                  >
                    Перейти к мифу <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Trigger Synthesis Button */}
          {!meetingResult && (
            <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-stone-400 text-center sm:text-left font-light">
                {isReadyForSynthesis
                  ? 'Оба зеркала сформированы. Запустите сопоставление параллелей и контрастов.'
                  : 'Для проведения встречи завершите обе линзы.'}
              </span>

              <button
                disabled={!isReadyForSynthesis || isLoading}
                onClick={handleRunSynthesis}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  isReadyForSynthesis
                    ? 'bg-[var(--color-antique-gold)] text-gray-950 hover:bg-[#D9B770] shadow-[0_0_20px_rgba(200,164,93,0.3)] cursor-pointer'
                    : 'bg-white/5 text-stone-500 cursor-not-allowed border border-white/[0.06]'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Синтезируем...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Провести Встречу Зеркал</span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-500/20 text-red-300 text-xs rounded-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SYNTHESIS RESULT CONTENT */}
        {/* ========================================================= */}
        <AnimatePresence>
          {meetingResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="w-full space-y-10"
            >
              {/* Summary */}
              <div className="bg-[#0D121D]/90 border border-[var(--color-antique-gold)]/40 p-8 sm:p-10 rounded-xs">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)]">
                    Итог сопоставления
                  </span>
                  {meetingResult.confidenceNote && (
                    <span className="text-xs text-stone-400 italic font-light">
                      {meetingResult.confidenceNote}
                    </span>
                  )}
                </div>

                <p className="font-serif text-xl sm:text-2xl text-stone-100 leading-relaxed font-light">
                  {meetingResult.summary}
                </p>
              </div>

              {/* 2-3 Parallels */}
              {meetingResult.parallels && meetingResult.parallels.length > 0 && (
                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                    Точки смыслового пересечения
                  </span>

                  <div className="space-y-4">
                    {meetingResult.parallels.map((item, idx) => (
                      <div key={idx} className="bg-[#0D121D]/60 border border-white/[0.08] p-6 sm:p-8 rounded-xs space-y-4">
                        <h4 className="font-serif text-xl sm:text-2xl text-stone-100 font-light">
                          {item.theme}
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="p-4 bg-[#090D15] border border-amber-500/20 rounded-xs">
                            <span className="text-[10px] uppercase text-[var(--color-antique-gold)] font-mono block mb-1">
                              Линза Кода:
                            </span>
                            <p className="text-stone-300 font-light leading-relaxed">{item.codeAnchor}</p>
                          </div>
                          <div className="p-4 bg-[#090D15] border border-purple-500/20 rounded-xs">
                            <span className="text-[10px] uppercase text-purple-300 font-mono block mb-1">
                              Линза Мифа:
                            </span>
                            <p className="text-stone-300 font-light leading-relaxed">{item.mythAnchor}</p>
                          </div>
                        </div>

                        <p className="text-sm text-stone-300 border-t border-white/[0.06] pt-4 font-serif italic leading-relaxed">
                          «{item.synthesis}»
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divergence / Contrast */}
              {meetingResult.divergences && meetingResult.divergences.length > 0 && (
                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-stone-400 block">
                    Различия ракурсов (где зеркала расходятся)
                  </span>

                  <div className="space-y-4">
                    {meetingResult.divergences.map((div, idx) => (
                      <div key={idx} className="bg-[#0D121D]/60 border border-white/[0.08] p-6 sm:p-8 rounded-xs space-y-3">
                        <h4 className="font-serif text-lg text-stone-200 font-light">
                          {div.theme}
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-[#090D15] border border-white/[0.06] text-stone-400 rounded-xs">
                            <span className="text-[10px] uppercase text-stone-500 font-mono block mb-1">В Коде:</span>
                            {div.codeAspect}
                          </div>
                          <div className="p-3 bg-[#090D15] border border-white/[0.06] text-stone-400 rounded-xs">
                            <span className="text-[10px] uppercase text-stone-500 font-mono block mb-1">В Мифе:</span>
                            {div.mythAspect}
                          </div>
                        </div>

                        <p className="text-xs text-stone-400 italic font-light pt-1">
                          {div.reflection}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Albert's Synthesis Insight & Living Question */}
              <div className="bg-[#0D121D]/90 border border-white/[0.08] p-8 sm:p-10 rounded-xs space-y-6">
                <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                  Взгляд Альберта Вяземского
                </span>
                
                <p className="font-serif text-lg sm:text-xl text-stone-100 leading-relaxed font-light">
                  {meetingResult.albertInsight}
                </p>

                <div className="border-t border-white/[0.06] pt-6">
                  <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-2">
                    Вопрос для личной рефлексии
                  </span>
                  <p className="font-serif italic text-lg sm:text-xl text-emerald-200 mb-4 font-light">
                    «{meetingResult.reflectiveQuestion}»
                  </p>
                  <textarea
                    rows={2}
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Запишите мысли или инсайты от этой встречи..."
                    className="w-full bg-[#080C14] border-0 border-b border-white/20 text-sm text-stone-200 py-3 outline-none focus:border-[var(--color-antique-gold)] resize-none font-light"
                  />
                </div>
              </div>

              {/* TELEGRAM CTA: ОБСУДИТЬ С АЛЬБЕРТОМ В TELEGRAM */}
              <div className="bg-[#0D121D]/80 border border-[var(--color-antique-gold)]/40 p-8 sm:p-10 rounded-xs text-center space-y-5">
                <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                  Продолжение исследования
                </span>
                
                <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                  Обсудить с Альбертом в Telegram
                </h3>
                
                <p className="text-xs sm:text-sm text-stone-400 font-light max-w-md mx-auto leading-relaxed">
                  Проводник Альберт Вяземский доступен в Telegram для сохранения контекста, разбора ваших чисел и глубокого диалога.
                </p>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
                  <a
                    href="https://t.me/digitalcodesystem_bot" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Обсудить в Telegram</span>
                  </a>

                  <button
                    onClick={() => {
                      setAlbertTopic(`Обсуждение синтеза: Душа ${codeResult?.soul}, Путь ${codeResult?.path}, Миф "${storyResult?.title}".`);
                      setIsAlbertOpen(true);
                    }}
                    className="px-6 py-3.5 border border-white/15 text-stone-300 hover:text-white uppercase tracking-[0.2em] text-xs rounded-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span>Диалог на сайте</span>
                  </button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Albert Web Dialogue Modal */}
      <AlbertDialogue
        isOpen={isAlbertOpen}
        onClose={() => setIsAlbertOpen(false)}
        calc={codeResult}
        initialTopic={albertTopic}
        theme="dark"
      />
    </div>
  );
}
