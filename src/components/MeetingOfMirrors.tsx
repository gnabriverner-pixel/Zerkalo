import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  BookOpen, 
  Compass, 
  MessageSquare, 
  Feather, 
  RefreshCw, 
  GitFork,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Send
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
        setErrorMessage(data.ui?.safe_message || 'Не удалось сформировать встречу зеркал. Пожалуйста, попробуйте еще раз.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Сетевая ошибка при сопоставлении линз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 bg-cosmic-mesh min-h-screen text-[#EAEAEA] font-sans relative overflow-x-hidden w-full">
      
      <div className="w-full max-w-4xl flex flex-col items-center relative z-10">
        
        {/* Title Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#121824] border border-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] text-[11px] tracking-widest uppercase mb-4">
            <GitFork size={12} className="text-[var(--color-antique-gold)]" />
            <span>Синтез двух независимых линз</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#F4F4F4] mb-3 tracking-wide">
            Встреча Зеркал
          </h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-xl mx-auto leading-relaxed font-light">
            Сопоставление объективной числовой матрицы по дате рождения и субъективного мира ваших личных метафор.
          </p>
        </div>

        {/* LENSES STATUS CARDS */}
        <div className="w-full glass-card p-6 sm:p-8 mb-8 rounded-xs">
          <h3 className="text-xs uppercase tracking-widest text-[var(--color-antique-gold)] mb-5 flex items-center gap-2 font-semibold">
            <Layers size={14} />
            <span>Состояние исходных зеркал</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Lens 1: Digital Code */}
            <div className={`p-5 rounded-xs border transition-all ${
              hasCode ? 'bg-[#101726] border-[var(--color-antique-gold)]/40 shadow-sm' : 'bg-[#0B0F18] border-white/5 opacity-75'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-gray-400 font-mono">Линза 1: Цифровой Код</span>
                {hasCode ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 size={15} /> Готов
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-500 uppercase">Не рассчитан</span>
                )}
              </div>
              {hasCode ? (
                <div className="flex items-center gap-3">
                  <Orb number={codeResult.soul} size="xs" glow={false} />
                  <div>
                    <div className="font-serif text-lg text-white">
                      Душа {codeResult.soul} · Путь {codeResult.path}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      Выражение {codeResult.expression} · Направление {codeResult.direction}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 flex flex-col items-start gap-2 mt-1">
                  <span>Введите дату рождения, чтобы сформировать расчет.</span>
                  <button 
                    onClick={onOpenCode}
                    className="text-[11px] text-[var(--color-antique-gold)] hover:underline uppercase tracking-wider flex items-center gap-1 font-semibold"
                  >
                    Перейти к коду <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Lens 2: Personal Myth */}
            <div className={`p-5 rounded-xs border transition-all ${
              hasMyth ? 'bg-[#101726] border-purple-500/40 shadow-sm' : 'bg-[#0B0F18] border-white/5 opacity-75'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-purple-300 font-mono">Линза 2: Личный Миф</span>
                {hasMyth ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 size={15} /> Создан
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-500 uppercase">Не пройден</span>
                )}
              </div>
              {hasMyth ? (
                <div className="flex items-center gap-3">
                  <Orb number={7} size="xs" glow={false} />
                  <div>
                    <div className="font-serif text-lg text-white italic">
                      «{storyResult.title}»
                    </div>
                    <div className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
                      Образ: {storyInputs.q2 || 'не назван'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 flex flex-col items-start gap-2 mt-1">
                  <span>Ответьте на 4 образных вопроса для создания сказки.</span>
                  <button 
                    onClick={onOpenMyth}
                    className="text-[11px] text-purple-300 hover:underline uppercase tracking-wider flex items-center gap-1 font-semibold"
                  >
                    Перейти к мифу <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Action to trigger synthesis */}
          {!meetingResult && (
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-400 text-center sm:text-left">
                {isReadyForSynthesis
                  ? 'Оба зеркала готовы к сопоставлению. Запустите встречу для поиска параллелей и контрастов.'
                  : 'Сначала завершите прохождение обеих линз выше.'}
              </div>

              <button
                disabled={!isReadyForSynthesis || isLoading}
                onClick={handleRunSynthesis}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-xs uppercase tracking-widest text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  isReadyForSynthesis
                    ? 'bg-[var(--color-antique-gold)] text-gray-950 hover:bg-[#D9B770] shadow-[0_0_20px_rgba(200,164,93,0.3)] cursor-pointer'
                    : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Синтез зеркал...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Провести встречу зеркал</span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* RESULTS OF MEETING */}
        <AnimatePresence>
          {meetingResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-8"
            >
              {/* SUMMARY CARD */}
              <div className="glass-card p-8 rounded-xs border-[var(--color-antique-gold)]/40 relative overflow-hidden">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-antique-gold)] bg-[var(--color-antique-gold)]/10 px-3 py-1 rounded-xs border border-[var(--color-antique-gold)]/20">
                    Итог встречи двух взглядов
                  </span>
                  
                  {meetingResult.confidenceNote && (
                    <span className="text-xs text-gray-400 italic">
                      {meetingResult.confidenceNote}
                    </span>
                  )}
                </div>

                <p className="font-serif text-xl sm:text-2xl text-white leading-relaxed font-light">
                  {meetingResult.summary}
                </p>
              </div>

              {/* PARALLELS SECTION */}
              {meetingResult.parallels && meetingResult.parallels.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-antique-gold)] font-semibold">
                    <Sparkles size={14} className="text-[var(--color-antique-gold)]" />
                    <span>Точки смыслового пересечения</span>
                  </div>

                  <div className="space-y-4">
                    {meetingResult.parallels.map((item, idx) => (
                      <div key={idx} className="glass-card p-6 rounded-xs border-white/10 hover:border-[var(--color-antique-gold)]/40 transition-all">
                        <h4 className="font-serif text-xl text-white mb-3">{item.theme}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                          <div className="p-3.5 bg-[#0B0F18] border border-amber-500/20 rounded-xs">
                            <span className="text-[10px] uppercase text-[var(--color-antique-gold)] font-mono block mb-1">Линза Кода:</span>
                            <span className="text-gray-300 leading-relaxed">{item.codeAnchor}</span>
                          </div>
                          <div className="p-3.5 bg-[#0B0F18] border border-purple-500/20 rounded-xs">
                            <span className="text-[10px] uppercase text-purple-300 font-mono block mb-1">Линза Мифа:</span>
                            <span className="text-gray-300 leading-relaxed">{item.mythAnchor}</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-200 border-t border-white/10 pt-3 leading-relaxed">
                          {item.synthesis}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DIVERGENCES / CONTRASTS */}
              {meetingResult.divergences && meetingResult.divergences.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400 font-semibold">
                    <GitFork size={14} className="text-[var(--color-antique-gold)]" />
                    <span>Различия ракурсов и дополняющие грани</span>
                  </div>

                  <div className="space-y-4">
                    {meetingResult.divergences.map((div, idx) => (
                      <div key={idx} className="glass-card p-6 rounded-xs border-white/10">
                        <h4 className="font-serif text-lg text-gray-200 mb-3">{div.theme}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-xs">
                          <div className="p-3 bg-[#090D15] border border-white/5 text-gray-400 rounded-xs">
                            <span className="text-[10px] uppercase text-gray-500 font-mono block mb-1">В Коде:</span>
                            {div.codeAspect}
                          </div>
                          <div className="p-3 bg-[#090D15] border border-white/5 text-gray-400 rounded-xs">
                            <span className="text-[10px] uppercase text-gray-500 font-mono block mb-1">В Мифе:</span>
                            {div.mythAspect}
                          </div>
                        </div>

                        <p className="text-xs text-gray-300 italic">
                          {div.reflection}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ALBERT'S SYNTHESIS INSIGHT */}
              <div className="glass-card p-8 rounded-xs border-[var(--color-antique-gold)]/40 relative">
                <div className="flex items-center gap-2.5 mb-4 text-[var(--color-antique-gold)]">
                  <Feather size={16} />
                  <span className="text-xs uppercase tracking-widest font-semibold">Взгляд Альберта Вяземского</span>
                </div>
                <p className="font-serif text-lg sm:text-xl text-[#F4F4F4] leading-relaxed mb-6 font-light">
                  {meetingResult.albertInsight}
                </p>

                {/* Living Reflective Question */}
                <div className="border-t border-white/10 pt-6 mt-6">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-antique-gold)] font-mono block mb-2">
                    Вопрос для личного исследования
                  </span>
                  <p className="font-serif italic text-base sm:text-lg text-emerald-200 mb-4">
                    «{meetingResult.reflectiveQuestion}»
                  </p>
                  <textarea
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Запишите здесь мысли, которые рождаются от этой встречи..."
                    className="w-full bg-[#080C14] border border-white/15 text-gray-200 text-sm p-4 outline-none focus:border-[var(--color-antique-gold)] resize-none h-24 rounded-xs placeholder:text-gray-600 font-sans"
                  />
                </div>
              </div>

              {/* ALBERT TELEGRAM CTA */}
              <div className="glass-card p-8 sm:p-10 rounded-xs border-[var(--color-antique-gold)]/50 text-center space-y-4 shadow-[0_0_40px_rgba(200,164,93,0.1)]">
                <div className="w-12 h-12 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-antique-gold)]/30 mx-auto flex items-center justify-center text-[var(--color-antique-gold)] mb-2">
                  <MessageSquare size={20} />
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl text-white">
                  Обсудить эту тему с Альбертом
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto leading-relaxed font-light">
                  Вы можете обсудить результаты встречи зеркал напрямую, задать уточняющий вопрос или продолжить исследование в Telegram-проводнике.
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
                  <button
                    onClick={() => {
                      setAlbertTopic(`Обсуждение встречи двух зеркал: Душа ${codeResult?.soul}, Путь ${codeResult?.path}, образ Мифа "${storyResult?.title}".`);
                      setIsAlbertOpen(true);
                    }}
                    className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 tracking-widest uppercase text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <MessageSquare size={15} />
                    <span>Диалог с Альбертом</span>
                  </button>

                  <a
                    href="https://t.me/digitalcodesystem_bot" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-8 py-3.5 border border-[var(--color-antique-gold)]/50 text-[var(--color-antique-gold)] tracking-widest uppercase text-xs font-semibold rounded-xs hover:bg-[var(--color-antique-gold)]/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Send size={14} />
                    <span>Telegram-проводник</span>
                  </a>
                </div>
              </div>

              {/* Refresh / Recalculate */}
              <div className="text-center pt-4 pb-12">
                <button
                  onClick={handleRunSynthesis}
                  className="text-xs text-gray-500 hover:text-[var(--color-antique-gold)] uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Обновить сопоставление</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Albert Dialogue Modal */}
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
