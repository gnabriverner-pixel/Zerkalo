import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  GitFork, 
  RefreshCw, 
  ChevronRight,
  MessageSquare,
  Bookmark,
  Check,
  Trash2
} from 'lucide-react';
import { CalculationResult, CodeV2Payload, FirstMirror, StoryInputs, ApiResponse, MeetingOfMirrorsResult, MeetingApiResponse } from '../types';
import { EmblemPlate } from '../art/emblem';
import { AlbertDialogue } from './AlbertDialogue';
import { TelegramContinuation } from './TelegramContinuation';
import { TesterFeedbackWidget } from './TesterFeedbackWidget';
import { generateFirstMirror } from '../services/interpretation';
import { firstMirrorFromV2 } from '../services/codeV2Session';
import { useProtectedFetch } from './ConsentBoundary';
import { 
  saveMyMirrorSnapshot, 
  loadMyMirrorSnapshot, 
  deleteMyMirrorSnapshot,
  isSnapshotMatchingCurrentSession
} from '../services/myMirrorStorage';

export interface MeetingOfMirrorsProps {
  codeDate?: string;
  codeV2Payload?: CodeV2Payload | null;
  journeyId?: string;
  onOpenAlbert?: () => void;
  codeResult: CalculationResult | null;
  firstMirror: FirstMirror | null;
  storyInputs: StoryInputs | null;
  storyResult: ApiResponse['story_result'] | null;
  initialMeetingResult?: MeetingOfMirrorsResult | null;
  onMeetingCompleted?: (result: MeetingOfMirrorsResult) => void;
  initialUserNote?: string;
  onUserNoteChange?: (note: string) => void;
  onSaveSnapshot?: () => void;
  onDeleteSnapshot?: () => void;
  onOpenCode: () => void;
  onOpenMyth: () => void;
}

export function MeetingOfMirrors({
  codeDate,
  codeV2Payload,
  journeyId,
  onOpenAlbert,
  codeResult,
  firstMirror,
  storyInputs,
  storyResult,
  initialMeetingResult,
  onMeetingCompleted,
  initialUserNote,
  onUserNoteChange,
  onSaveSnapshot,
  onDeleteSnapshot,
  onOpenCode,
  onOpenMyth
}: MeetingOfMirrorsProps) {
  const protectedFetch = useProtectedFetch();
  const [meetingResult, setMeetingResult] = useState<MeetingOfMirrorsResult | null>(initialMeetingResult || null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAlbertOpen, setIsAlbertOpen] = useState(false);
  const [albertTopic, setAlbertTopic] = useState('');
  const [userNote, setUserNote] = useState(initialUserNote || '');

  const effectiveFirstMirror = (): FirstMirror | null => {
    if (firstMirror) return firstMirror;
    if (codeV2Payload) return firstMirrorFromV2(codeV2Payload);
    return codeResult ? generateFirstMirror(codeResult) : null;
  };

  const checkCurrentSaveStatus = (): string | null => {
    const current = loadMyMirrorSnapshot();
    if (!current) return null;
    const currentFirstMirror = effectiveFirstMirror();
    const matches = isSnapshotMatchingCurrentSession(current, {
      codeDate,
      codeResult,
      firstMirror: currentFirstMirror,
      storyInputs,
      storyResult,
      meetingResult,
      meetingUserNote: userNote
    });
    return matches ? current.savedAt : null;
  };

  const [savedAt, setSavedAt] = useState<string | null>(() => checkCurrentSaveStatus());

  useEffect(() => {
    setMeetingResult(initialMeetingResult || null);
  }, [initialMeetingResult]);

  useEffect(() => {
    if (initialUserNote !== undefined) {
      setUserNote(initialUserNote);
    }
  }, [initialUserNote]);

  useEffect(() => {
    setSavedAt(checkCurrentSaveStatus());
  }, [codeDate, codeResult, firstMirror, storyInputs, storyResult, meetingResult, userNote]);

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult && !!storyInputs;
  const isReadyForSynthesis = hasCode && hasMyth;

  const handleUserNoteChange = (val: string) => {
    setUserNote(val);
    if (onUserNoteChange) onUserNoteChange(val);
  };

  const handleSave = () => {
    if (!codeResult || !storyInputs || !storyResult || !meetingResult) return;
    const currentFirstMirror = effectiveFirstMirror();
    if (!currentFirstMirror) return;
    const success = saveMyMirrorSnapshot({
      codeDate: codeDate || `${codeResult.soul}.${codeResult.expression}.${codeResult.path}`,
      codeResult,
      codeV2Payload,
      journeyId,
      firstMirror: currentFirstMirror,
      storyInputs,
      storyResult,
      meetingResult,
      meetingUserNote: userNote || undefined
    });
    if (success) {
      const loaded = loadMyMirrorSnapshot();
      setSavedAt(loaded?.savedAt || new Date().toISOString());
      if (onSaveSnapshot) onSaveSnapshot();
    }
  };

  const handleDelete = () => {
    deleteMyMirrorSnapshot();
    setSavedAt(null);
    if (onDeleteSnapshot) onDeleteSnapshot();
  };

  const synthesisRequest = useRef<AbortController | null>(null);
  useEffect(() => () => synthesisRequest.current?.abort(), []);

  const handleRunSynthesis = async () => {
    if (!isReadyForSynthesis) return;
    const currentFirstMirror = effectiveFirstMirror();
    if (!currentFirstMirror) {
      setErrorMessage('Не удалось восстановить первое зеркало. Вернитесь к Коду и повторите расчёт.');
      return;
    }

    synthesisRequest.current?.abort();
    const controller = new AbortController();
    synthesisRequest.current = controller;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await protectedFetch('/api/meeting-of-mirrors', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeData: {
            calc: codeResult,
            firstMirror: currentFirstMirror,
            codeV2Payload: codeV2Payload || undefined
          },
          storyData: {
            storyInputs,
            storyResult
          }
        })
      });
      if (!response) return;

      const data: MeetingApiResponse = await response.json();
      if (controller.signal.aborted) return;

      if (data.status === 'ok' && data.result) {
        setMeetingResult(data.result);
        if (onMeetingCompleted) {
          onMeetingCompleted(data.result);
        }
      } else {
        setErrorMessage(data.ui?.safe_message || 'Не удалось сформировать встречу зеркал. Попробуйте еще раз.');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setErrorMessage('Связь с зеркалом прервалась при сопоставлении линз.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
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
              <EmblemPlate planet={codeResult?.soul || 1} variant="obsidian" size={130} />
            </motion.div>

            <motion.div
              initial={{ x: 25, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.9 }}
              className="relative z-20"
            >
              <EmblemPlate planet={7} variant="alabaster" size={130} showNumber={false} showLabel={false} />
            </motion.div>
          </div>

          <span className="text-[13px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] mb-3">
            Синтез двух зеркал · Встреча
          </span>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-stone-100 mb-4 tracking-tight">
            Встреча Зеркал
          </h1>

          <p className="text-sm sm:text-base text-stone-300 font-normal max-w-xl mx-auto leading-relaxed">
            Два независимых взгляда встречаются, чтобы показать новое различие и возможную опору — без требования согласиться с ними.
          </p>
        </div>

        {/* ========================================================= */}
        {/* PRE-MEETING STATUS & CARDS */}
        {/* ========================================================= */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          
          {/* Lens 1: Code */}
          <div className={`p-6 rounded-xs border transition-all ${
            hasCode 
              ? 'bg-[#0D121D] border-white/10' 
              : 'bg-[#0D121D]/40 border-dashed border-white/10'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[13px] uppercase font-mono tracking-widest text-stone-400">
                Линза 1 · Цифровой код
              </span>
              {hasCode ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-400 font-mono">
                  <CheckCircle2 size={13} />
                  <span>Собрано</span>
                </span>
              ) : (
                <span className="text-sm text-amber-400/80 font-mono">Не рассчитано</span>
              )}
            </div>

            {hasCode ? (
              <div>
                <h3 className="font-serif text-xl text-stone-100 mb-1">
                  Формула: {codeResult.soul} / {codeResult.expression} / {codeResult.path}
                </h3>
                <p className="text-sm text-stone-300 font-normal leading-relaxed line-clamp-3">
                  {firstMirror?.keyInsight || `Число Души ${codeResult.soul}, Путь ${codeResult.path}`}
                </p>
              </div>
            ) : (
              <button
                onClick={onOpenCode}
                className="text-sm text-[var(--color-antique-gold)] hover:underline flex items-center gap-1 mt-2 cursor-pointer"
              >
                <span>Рассчитать код</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* Lens 2: Myth */}
          <div className={`p-6 rounded-xs border transition-all ${
            hasMyth 
              ? 'bg-[#0D121D] border-white/10' 
              : 'bg-[#0D121D]/40 border-dashed border-white/10'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[13px] uppercase font-mono tracking-widest text-stone-400">
                Линза 2 · Личный миф
              </span>
              {hasMyth ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-400 font-mono">
                  <CheckCircle2 size={13} />
                  <span>Сотворено</span>
                </span>
              ) : (
                <span className="text-sm text-amber-400/80 font-mono">Не создано</span>
              )}
            </div>

            {hasMyth ? (
              <div>
                <h3 className="font-serif text-xl text-stone-100 mb-1">
                  «{storyResult.title}»
                </h3>
                <p className="text-sm text-stone-300 font-normal leading-relaxed line-clamp-3">
                  {storyResult.story}
                </p>
              </div>
            ) : (
              <button
                onClick={onOpenMyth}
                className="text-sm text-[var(--color-antique-gold)] hover:underline flex items-center gap-1 mt-2 cursor-pointer"
              >
                <span>Создать Личный миф</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

        </div>

        {/* Synthesis Action Button */}
        {!meetingResult && (
          <div className="flex flex-col items-center mb-12">
            <button
              onClick={handleRunSynthesis}
              disabled={!isReadyForSynthesis || isLoading}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xs uppercase tracking-[0.18em] text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                isReadyForSynthesis && !isLoading
                  ? 'bg-[var(--color-antique-gold)] text-gray-950 hover:bg-[#D9B770] cursor-pointer shadow-md'
                  : 'bg-white/5 text-stone-500 cursor-not-allowed border border-white/[0.06]'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-stone-400" />
                  <span>Сопоставляем отражения...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Провести Встречу зеркал</span>
                </>
              )}
            </button>

            {errorMessage && (
              <p className="mt-3 text-sm text-red-300 flex items-center gap-1.5">
                <AlertCircle size={13} />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* SYNTHESIS RESULTS DISPLAY */}
        {/* ========================================================= */}
        <AnimatePresence>
          {meetingResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="w-full space-y-8"
            >
              {/* Summary & Confidence Header */}
              <div className="bg-[#0D121D] border border-[var(--color-border-gold)] p-8 sm:p-10 rounded-xs text-left relative overflow-hidden">
                <div className="space-y-3 mb-5">
                  <h3 className="font-serif text-xl sm:text-2xl text-[var(--color-antique-gold)] font-normal">
                    Что становится видно рядом
                  </h3>
                  <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-2xl">
                    {meetingResult.confidenceNote}
                  </p>
                </div>

                <p className="font-serif text-xl sm:text-2xl text-stone-100 font-normal leading-relaxed mb-6">
                  {meetingResult.summary}
                </p>

                {meetingResult.possibleSupport && (
                  <div className="bg-[var(--color-antique-gold)]/[0.07] border border-[var(--color-antique-gold)]/25 p-5 sm:p-6 mb-6 rounded-xs">
                    <span className="text-[13px] uppercase font-mono tracking-[0.22em] text-[var(--color-antique-gold)] block mb-3">
                      Возможная опора
                    </span>
                    <p className="font-serif text-lg sm:text-xl text-stone-100 leading-relaxed">
                      {meetingResult.possibleSupport}
                    </p>
                    <p className="text-sm text-stone-400 leading-relaxed mt-3">
                      Это гипотеза из ваших слов и двух линз. Оставьте только то, что подтверждается вашим опытом.
                    </p>
                  </div>
                )}

                {meetingResult.disclaimer && (
                  <p className="text-sm sm:text-base text-stone-400 font-normal border-t border-white/[0.06] pt-4 leading-relaxed">
                    {meetingResult.disclaimer}
                  </p>
                )}
              </div>

              {/* Zero-resonance state banner if parallels is empty */}
              {meetingResult.parallels.length === 0 && (
                <div className="bg-[#0D121D] border border-white/[0.08] p-8 sm:p-10 rounded-xs text-left space-y-4">
                  <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                    Нулевая встреча — полноценный результат
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                    Сильных резонансов не найдено
                  </h3>
                  <p className="text-base text-stone-300 font-normal leading-relaxed max-w-2xl">
                    Два независимых взгляда показывают разные плоскости: мы не превращаем отдельные похожие слова в искусственную связь.
                  </p>
                </div>
              )}

              {/* Parallels Section */}
              {meetingResult.parallels.length > 0 && (
                <div className="space-y-4 text-left">
                  <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                    Смысловые резонансы (где зеркала сходятся)
                  </span>

                  <div className="grid grid-cols-1 gap-6">
                    {meetingResult.parallels.map((p, idx) => (
                      <div 
                        key={idx}
                        className="bg-[#0D121D] border border-white/[0.08] p-6 sm:p-8 rounded-xs space-y-4"
                      >
                        <h4 className="font-serif text-xl sm:text-2xl text-stone-100 font-light">
                          {p.theme}
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-[#E8E0D4] border border-[#C8A45D]/35 p-4 rounded-xs text-[#2B241C]">
                            <span className="text-[13px] uppercase font-mono tracking-widest text-[#7C5A20] block mb-1.5 font-medium">
                              Линза Кода:
                            </span>
                            <p className="text-sm sm:text-base font-sans leading-relaxed text-[#2B241C]">
                              {p.codeAnchor}
                            </p>
                          </div>

                          <div className="bg-[#EFE5D3] border border-[#B89568]/35 p-4 rounded-xs text-[#282019]">
                            <span className="text-[13px] uppercase font-mono tracking-widest text-[#7C5A20] block mb-1.5 font-medium">
                              Линза Мифа:
                            </span>
                            <p className="text-sm sm:text-base font-sans leading-relaxed text-[#282019]">
                              {p.mythAnchor}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/[0.06]">
                          <p className="text-base sm:text-lg leading-relaxed text-stone-300 font-serif italic">
                            «{p.synthesis}»
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divergences Section */}
              {meetingResult.divergences.length > 0 && (
                <div className="space-y-4 text-left">
                  <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                    Различия ракурсов (где зеркала расходятся)
                  </span>

                  <div className="grid grid-cols-1 gap-6">
                    {meetingResult.divergences.map((d, idx) => (
                      <div 
                        key={idx}
                        className="bg-[#0D121D] border border-white/[0.08] p-6 sm:p-8 rounded-xs space-y-4"
                      >
                        <h4 className="font-serif text-xl sm:text-2xl text-stone-100 font-light">
                          {d.theme}
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-[#E8E0D4] border border-[#C8A45D]/35 p-4 rounded-xs text-[#2B241C]">
                            <span className="text-[13px] uppercase font-mono tracking-widest text-[#7C5A20] block mb-1.5 font-medium">
                              Линза Кода:
                            </span>
                            <p className="text-sm sm:text-base font-sans leading-relaxed text-[#2B241C]">
                              {d.codeAspect}
                            </p>
                          </div>

                          <div className="bg-[#EFE5D3] border border-[#B89568]/35 p-4 rounded-xs text-[#282019]">
                            <span className="text-[13px] uppercase font-mono tracking-widest text-[#7C5A20] block mb-1.5 font-medium">
                              Линза Мифа:
                            </span>
                            <p className="text-sm sm:text-base font-sans leading-relaxed text-[#282019]">
                              {d.mythAspect}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/[0.06]">
                          <p className="text-base sm:text-lg leading-relaxed text-stone-300 font-serif italic">
                            «{d.reflection}»
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Albert's Synthesis Insight & Living Question */}
              <div className="bg-[#0D121D] border border-white/[0.08] p-8 sm:p-10 rounded-xs space-y-6 text-left">
                <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                  Новое различение
                </span>
                
                <p className="font-serif text-lg sm:text-xl text-stone-100 leading-relaxed font-normal">
                  {meetingResult.albertInsight}
                </p>

                <div className="border-t border-white/[0.06] pt-6">
                  <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-2">
                    Проверка на своём опыте
                  </span>
                  <p className="font-serif italic text-lg sm:text-xl text-emerald-200 mb-4 font-normal">
                    «{meetingResult.reflectiveQuestion}»
                  </p>
                  <textarea
                    rows={2}
                    value={userNote}
                    onChange={(e) => handleUserNoteChange(e.target.value)}
                    placeholder="Что здесь похоже на ваш опыт, а что хочется уточнить или отвергнуть?"
                    className="w-full bg-[#080C14] border-0 border-b border-white/20 text-base text-stone-200 py-3 outline-none focus:border-[var(--color-antique-gold)] resize-none font-normal"
                  />
                </div>
              </div>

              {/* ALBERT CONTINUATION CTA */}
              <div className="bg-[#0D121D] border border-[var(--color-antique-gold)]/40 p-8 sm:p-10 rounded-xs text-center space-y-5">
                <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                  Продолжение исследования
                </span>
                
                <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                  Исследовать синтез с Альбертом
                </h3>
                
                <p className="text-sm sm:text-base text-stone-300 font-normal max-w-lg mx-auto leading-relaxed">
                  Задайте вопрос Альберту прямо на сайте: он удерживает структуру вашего Кода, образы Мифа и найденные параллели.
                </p>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
                  <button
                    onClick={() => {
                      if (onOpenAlbert) { onOpenAlbert(); return; }
                      setAlbertTopic(meetingResult?.reflectiveQuestion || meetingResult?.albertInsight || 'Продолжение исследования');
                      setIsAlbertOpen(true);
                    }}
                    className="w-full sm:w-auto px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.18em] text-sm font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span>Диалог на сайте</span>
                  </button>

                  <TelegramContinuation
                    codeResult={codeResult}
                    storyResult={storyResult}
                    meetingResult={meetingResult}
                    journeyId={journeyId}
                  />
                </div>
                <p className="text-sm leading-relaxed text-stone-400 max-w-lg mx-auto">
                  Выберите: продолжить разговор здесь или перенести краткий контекст к Альберту в Telegram. Передача потребует отдельного согласия.
                </p>
              </div>

              {/* LOCAL PERSISTENCE BRIDGE (MY MIRROR V0) */}
              <div className="bg-[#0D121D]/90 border border-white/[0.08] p-6 sm:p-8 rounded-xs space-y-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <Bookmark size={14} className="text-[var(--color-antique-gold)]" />
                    <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)]">
                      Моё зеркало · Локальное сохранение
                    </span>
                  </div>
                  {savedAt && (
                    <span className="text-[13px] font-mono text-emerald-400/90 flex items-center gap-1.5">
                      <Check size={12} />
                      <span>Сохранено в этом браузере</span>
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-serif text-lg sm:text-xl text-stone-100 font-light mb-1">
                    {savedAt ? 'Зеркало сохранено на этом устройстве' : 'Сохранить в «Моё зеркало»'}
                  </h4>
                  <p className="text-sm text-stone-400 font-normal leading-relaxed max-w-xl">
                    Код, ваши 4 ответа, Личный миф и Встреча сохранятся только в этом браузере на этом устройстве. Нового серверного хранения не создаётся.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={handleSave}
                    className={`px-5 py-2.5 rounded-xs uppercase tracking-[0.2em] text-[13px] font-medium transition-all flex items-center gap-2 cursor-pointer ${
                      savedAt
                        ? 'bg-white/10 text-stone-200 hover:bg-white/15 border border-white/20'
                        : 'border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)]'
                    }`}
                  >
                    <Bookmark size={13} />
                    <span>{savedAt ? 'Обновить сохранённое' : 'Сохранить на этом устройстве'}</span>
                  </button>

                  {savedAt && (
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2.5 text-stone-400 hover:text-red-300 uppercase tracking-[0.18em] text-[13px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Удалить сохранённое</span>
                    </button>
                  )}
                </div>
              </div>

              <TesterFeedbackWidget />

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Albert Web Dialogue Modal */}
      <AlbertDialogue
        isOpen={isAlbertOpen}
        onClose={() => setIsAlbertOpen(false)}
        journeyId={journeyId}
        codeV2Payload={codeV2Payload}
        codeV2Context={codeV2Payload?.albert_context}
        userNote={userNote}
        onUserNoteChange={handleUserNoteChange}
        calc={codeResult}
        storyResult={storyResult}
        meetingResult={meetingResult}
        initialTopic={albertTopic}
        theme="dark"
      />
    </div>
  );
}
