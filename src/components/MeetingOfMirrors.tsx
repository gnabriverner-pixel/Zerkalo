import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-20 sm:py-28 px-6 sm:px-10 text-[var(--color-text-primary)] font-sans relative overflow-x-hidden w-full">
      
      <div className="w-full max-w-4xl flex flex-col items-center relative z-10 my-auto space-y-24 sm:space-y-32">
        
        {/* ========================================================= */}
        {/* VISUAL CENTER: TWO CONVERGING ORBS IN OPEN SPACE          */}
        {/* ========================================================= */}
        <div className="flex flex-col items-center text-center space-y-8 max-w-2xl mx-auto">
          
          <div className="flex items-center justify-center -space-x-6 mb-2 relative">
            <motion.div
              initial={{ x: -25, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1 }}
              className="relative z-10"
            >
              <Orb number={codeResult?.soul || 1} size="lg" glow={true} />
            </motion.div>

            <motion.div
              initial={{ x: 25, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1 }}
              className="relative z-20"
            >
              <Orb number={7} size="lg" glow={true} />
            </motion.div>
          </div>

          <span className="text-[11px] uppercase tracking-[0.42em] text-[var(--color-antique-gold)] font-mono block opacity-85">
            Синтез · Гармония Двух Отражений
          </span>

          <h1 className="font-serif text-5xl sm:text-7xl text-[var(--color-text-primary)] font-light tracking-tight leading-tight">
            Встреча Зеркал
          </h1>

          <p className="font-serif italic text-xl sm:text-2xl text-[#EAE4D7] leading-[1.8] font-light">
            «Два независимых взгляда встречаются в одном небе: вечный рисунок вашей даты рождения и живая сказка вашего сегодняшнего состояния.»
          </p>
        </div>

        {/* ========================================================= */}
        {/* STATUS OF THE TWO ORBITS (AIRY TWO-COLUMN VIEW)           */}
        {/* ========================================================= */}
        <div className="w-full max-w-3xl pt-12 border-t border-white/[0.08] space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 relative">
            
            <div className="hidden sm:block absolute left-1/2 top-2 bottom-2 w-px bg-white/[0.08] -translate-x-1/2 pointer-events-none" />

            {/* Orbit 1: Digital Code */}
            <div className="space-y-4 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-antique-gold)] font-mono">
                  Орбита II · Космос Даты
                </span>
                {hasCode && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-light">
                    <CheckCircle2 size={13} /> Открыт
                  </span>
                )}
              </div>

              {hasCode ? (
                <div className="flex items-center justify-center sm:justify-start gap-4 pt-1">
                  <Orb number={codeResult.soul} size="sm" glow={false} />
                  <div className="text-left">
                    <div className="font-serif text-2xl text-[var(--color-text-primary)] font-light">
                      Душа {codeResult.soulComposite} · Путь {codeResult.pathComposite}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                      Выражение {codeResult.expressionComposite}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                    Откройте звёздный атлас своей даты рождения.
                  </p>
                  <button 
                    onClick={onOpenCode}
                    className="text-[11px] text-[var(--color-antique-gold)] hover:underline uppercase tracking-[0.25em] inline-flex items-center gap-1 font-mono cursor-pointer"
                  >
                    Перейти к дате <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Orbit 2: Personal Myth */}
            <div className="space-y-4 text-center sm:text-left sm:pl-6">
              <div className="flex items-center justify-center sm:justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#7CE8EE] font-mono">
                  Орбита I · Личный Миф
                </span>
                {hasMyth && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-light">
                    <CheckCircle2 size={13} /> Создан
                  </span>
                )}
              </div>

              {hasMyth ? (
                <div className="flex items-center justify-center sm:justify-start gap-4 pt-1">
                  <Orb number={7} size="sm" glow={false} />
                  <div className="text-left">
                    <div className="font-serif text-2xl text-[var(--color-text-primary)] italic font-light">
                      «{storyResult.title}»
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono truncate max-w-[200px] mt-0.5">
                      Образ: {storyInputs.q2 || 'открытый горизонт'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                    Ответьте на 4 образных вопроса для рождения вашей сказки.
                  </p>
                  <button 
                    onClick={onOpenMyth}
                    className="text-[11px] text-[#7CE8EE] hover:underline uppercase tracking-[0.25em] inline-flex items-center gap-1 font-mono cursor-pointer"
                  >
                    Перейти к мифу <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Trigger Synthesis Button */}
          {!meetingResult && (
            <div className="pt-10 border-t border-white/[0.08] flex flex-col items-center text-center space-y-6">
              <span className="text-sm text-[var(--color-text-secondary)] font-light">
                {isReadyForSynthesis
                  ? 'Оба созвездия открыты. Прикоснитесь, чтобы услышать их общее звучание.'
                  : 'Когда обе орбиты будут пройдены, здесь откроется их живое созвучие.'}
              </span>

              <button
                disabled={!isReadyForSynthesis || isLoading}
                onClick={handleRunSynthesis}
                className="px-10 py-4 border border-[var(--color-antique-gold)]/45 bg-[var(--color-antique-gold)]/[0.08] hover:bg-[var(--color-antique-gold)]/[0.18] text-[var(--color-antique-gold)] rounded-full uppercase tracking-[0.28em] text-[11px] font-mono transition-all disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Соединяем созвездия...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Соединить два отражения</span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="text-amber-300 text-xs flex items-center justify-center gap-2 font-light">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SYNTHESIS RESULT: FLOWING HARMONY OF MEANINGS             */}
        {/* ========================================================= */}
        <AnimatePresence>
          {meetingResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 }}
              className="w-full max-w-2xl mx-auto space-y-24 text-left"
            >
              {/* Summary */}
              <div className="pt-12 border-t border-white/[0.08] space-y-4 text-center">
                <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[var(--color-antique-gold)] block">
                  Единое созвучие
                </span>

                <p className="font-serif text-2xl sm:text-3xl text-[#F7F4ED] leading-[1.8] font-light">
                  {meetingResult.summary}
                </p>

                {meetingResult.confidenceNote && (
                  <p className="text-xs text-[var(--color-text-muted)] italic font-light pt-2">
                    {meetingResult.confidenceNote}
                  </p>
                )}
              </div>

              {/* Parallels */}
              {meetingResult.parallels && meetingResult.parallels.length > 0 && (
                <div className="space-y-12 pt-12 border-t border-white/[0.08]">
                  <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[#7CE8EE] block text-center">
                    Где ваши числа и ваша сказка поют в унисон
                  </span>

                  <div className="space-y-14">
                    {meetingResult.parallels.map((item, idx) => (
                      <div key={idx} className="space-y-5">
                        <h4 className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light">
                          {item.theme}
                        </h4>

                        <p className="font-serif text-xl text-[var(--color-text-secondary)] leading-[1.85] font-light">
                          В вашем звёздном коде звучит: <span className="text-white">{item.codeAnchor}</span> А в вашей сказке это же движение откликается через образ: <span className="text-white">{item.mythAnchor}</span>
                        </p>

                        <p className="font-serif italic text-xl sm:text-2xl text-[var(--color-antique-gold)] leading-[1.8] font-light">
                          «{item.synthesis}»
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divergences */}
              {meetingResult.divergences && meetingResult.divergences.length > 0 && (
                <div className="space-y-12 pt-12 border-t border-white/[0.08]">
                  <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[var(--color-antique-gold)] block text-center">
                    Простор между двумя берегами
                  </span>

                  <div className="space-y-12">
                    {meetingResult.divergences.map((div, idx) => (
                      <div key={idx} className="space-y-4">
                        <h4 className="font-serif text-2xl text-[var(--color-text-primary)] font-light">
                          {div.theme}
                        </h4>

                        <p className="font-serif text-xl text-[var(--color-text-secondary)] leading-[1.85] font-light">
                          Природа даты напоминает: <span className="text-white">{div.codeAspect}</span> В то время как сегодняшнее состояние ищет: <span className="text-white">{div.mythAspect}</span>
                        </p>

                        <p className="font-serif italic text-lg text-[#EAE4D7] font-light leading-[1.8]">
                          {div.reflection}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Albert's Synthesis Insight & Living Question */}
              <div className="pt-16 border-t border-white/[0.08] space-y-8 text-center">
                <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[var(--color-antique-gold)] block">
                  Слово Альберта Вяземского
                </span>
                
                <p className="font-serif text-xl sm:text-2xl text-[var(--color-text-primary)] leading-[1.9] font-light">
                  {meetingResult.albertInsight}
                </p>

                <div className="pt-10 space-y-6">
                  <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[#7CE8EE] block">
                    Вопрос для внутренней тишины
                  </span>
                  <p className="font-serif italic text-2xl sm:text-3xl text-[#F7F4ED] font-light leading-[1.75]">
                    «{meetingResult.reflectiveQuestion}»
                  </p>
                  <textarea
                    rows={2}
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Запишите здесь свою мысль или отклик..."
                    className="w-full bg-transparent border-0 border-b border-white/20 text-base font-serif text-center text-[var(--color-text-primary)] py-3 outline-none focus:border-[var(--color-antique-gold)] resize-none font-light"
                  />
                </div>
              </div>

              {/* OPEN DIALOGUE CTA */}
              <div className="pt-16 border-t border-white/[0.08] text-center space-y-8">
                <h3 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light">
                  Продолжить разговор с Альбертом
                </h3>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
                  <button
                    onClick={() => {
                      setAlbertTopic(`Обсуждение синтеза: Душа ${codeResult?.soul}, Путь ${codeResult?.path}, Миф "${storyResult?.title}".`);
                      setIsAlbertOpen(true);
                    }}
                    className="px-9 py-4 border border-[var(--color-antique-gold)]/45 bg-[var(--color-antique-gold)]/[0.08] hover:bg-[var(--color-antique-gold)]/[0.18] text-[var(--color-antique-gold)] uppercase tracking-[0.25em] text-[11px] font-mono rounded-full transition-all flex items-center gap-2.5 cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span>Диалог на сайте</span>
                  </button>

                  <a
                    href="https://t.me/digitalcodesystem_bot" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-9 py-4 border border-white/15 hover:border-white/35 text-[var(--color-text-primary)] uppercase tracking-[0.25em] text-[11px] font-mono rounded-full transition-all flex items-center gap-2.5 cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Перейти в Telegram</span>
                  </a>
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
