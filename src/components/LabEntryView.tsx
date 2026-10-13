import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, RotateCcw, ChevronRight, Trash2 } from 'lucide-react';
import { Orb } from './Orb';
import { PantheonModal } from './PantheonModal';
import { SampleStoryModal } from './SampleStoryModal';
import { CalculationResult, ApiResponse } from '../types';
import { MyMirrorSnapshotV1, TransientDraftV1 } from '../services/myMirrorStorage';
import mirrorHero from '../assets/mirror-hero.jpg';
import mirrorHeroWebp from '../assets/mirror-hero.webp';
import mirrorHeroMobile from '../assets/mirror-hero-mobile.webp';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface LabEntryViewProps {
  meetingAvailable?: boolean;
  onSelectMyth?: () => void;
  onSelectCode?: (initialDate?: string, options?: { autoCalculate?: boolean }) => void;
  onSelectMeeting?: () => void;
  onOpenPantheon?: () => void;
  onSelectMode?: (mode: 'entry' | 'code' | 'myth' | 'meeting' | 'ab-test', initialDate?: string, options?: { autoCalculate?: boolean }) => void;
  hasCodeResult?: boolean;
  hasMythResult?: boolean;
  codeResult?: CalculationResult | null;
  storyResult?: ApiResponse['story_result'] | null;
  savedSnapshot?: MyMirrorSnapshotV1 | null;
  onRestoreSavedMirror?: () => void;
  onDeleteSavedMirror?: () => void;
  transientDraft?: TransientDraftV1 | null;
  onRestoreDraft?: () => void;
  onClearDraft?: () => void;
}

export function LabEntryView({
  meetingAvailable = true,
  onSelectMyth,
  onSelectCode,
  onSelectMeeting,
  onOpenPantheon,
  onSelectMode,
  hasCodeResult,
  hasMythResult,
  codeResult,
  storyResult,
  savedSnapshot,
  onRestoreSavedMirror,
  onDeleteSavedMirror,
  transientDraft,
  onRestoreDraft,
  onClearDraft,
}: LabEntryViewProps) {
  const [isPantheonOpen, setIsPantheonOpen] = useState(false);
  const [isSampleStoryOpen, setIsSampleStoryOpen] = useState(false);
  const shouldReduceMotion = usePrefersReducedMotion();
  const easeTransition = [0.16, 1, 0.3, 1] as const;

  const hasCode = hasCodeResult !== undefined ? hasCodeResult : !!codeResult;
  const hasMyth = hasMythResult !== undefined ? hasMythResult : !!storyResult;
  const isMeetingReady = hasCode && hasMyth;

  const handleStartMyth = () => {
    if (onSelectMyth) onSelectMyth();
    else if (onSelectMode) onSelectMode('myth');
  };

  const handleSelectCode = () => {
    if (onSelectCode) onSelectCode();
    else if (onSelectMode) onSelectMode('code');
  };

  const handleSelectCodeSample = () => {
    if (onSelectCode) onSelectCode('14.03.1987', { autoCalculate: true });
    else if (onSelectMode) onSelectMode('code', '14.03.1987', { autoCalculate: true });
  };

  const handleMeeting = () => {
    if (onSelectMeeting) onSelectMeeting();
    else if (onSelectMode) onSelectMode('meeting');
  };

  const handlePantheon = () => {
    if (onOpenPantheon) onOpenPantheon();
    else setIsPantheonOpen(true);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-64px)] min-h-[calc(100dvh-64px)] px-3.5 sm:px-6 lg:px-8 text-[var(--color-text-primary)] font-sans relative overflow-x-hidden w-full selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      {/* Background Moon & Sacred Geometry with Radiant Warm Gold Glow */}
      <div className="absolute inset-x-0 top-0 h-[640px] sm:h-[760px] lg:h-[860px] pointer-events-none overflow-hidden select-none" aria-hidden="true">
        {/* Soft Golden Coronal Glow breathing behind the Moon */}
        <motion.div
          animate={shouldReduceMotion ? { opacity: 0.85, scale: 1 } : {
            opacity: [0.75, 0.98, 0.75],
            scale: [0.97, 1.03, 0.97],
          }}
          transition={shouldReduceMotion ? { duration: 0.01 } : {
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute rounded-full pointer-events-none left-1/2 -translate-x-1/2"
          style={{
            background: 'radial-gradient(circle, rgba(224,198,147,0.32) 0%, rgba(200,164,93,0.18) 40%, rgba(200,164,93,0.06) 62%, transparent 75%)',
            filter: 'blur(36px)',
            width: '380px',
            height: '380px',
            top: '10px',
          }}
        />

        {/* High-definition Moon & Sacred Geometry Artwork with Celestial Drift */}
        <motion.div
          animate={shouldReduceMotion ? { y: 0 } : { y: [-3, 3, -3] }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 -translate-x-1/2 top-[-165px] sm:top-[-190px] lg:top-[-240px] w-[1250px] sm:w-[1440px] lg:w-[1800px] h-[708px] sm:h-[816px] lg:h-[1020px] pointer-events-none flex items-center justify-center"
        >
          <picture className="w-full h-full block">
            <source media="(max-width: 640px)" srcSet={mirrorHeroMobile} type="image/webp" />
            <source srcSet={mirrorHeroWebp} type="image/webp" />
            <img
              src={mirrorHero}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-contain opacity-90 sm:opacity-95 mix-blend-screen filter brightness-[1.18] contrast-[1.12]"
            />
          </picture>
        </motion.div>

        {/* Delicate Astrolabe Alignment Lines & Star Coordinates */}
        <svg 
          className="absolute left-1/2 -translate-x-1/2 top-[180px] sm:top-[210px] lg:top-[260px] -translate-y-1/2 w-[350px] sm:w-[440px] lg:w-[540px] h-[350px] sm:h-[440px] lg:h-[540px] pointer-events-none opacity-40 sm:opacity-55"
          viewBox="0 0 500 500"
          fill="none"
        >
          <circle cx="250" cy="250" r="185" stroke="#C8A45D" strokeWidth="0.5" strokeDasharray="3 6" strokeOpacity="0.45" />
          <circle cx="250" cy="250" r="235" stroke="#C8A45D" strokeWidth="0.5" strokeDasharray="1 8" strokeOpacity="0.35" />
          <circle cx="250" cy="15" r="2.5" fill="#E0C693" opacity="0.85" />
          <circle cx="250" cy="485" r="2.5" fill="#E0C693" opacity="0.85" />
          <circle cx="15" cy="250" r="2" fill="#E0C693" opacity="0.7" />
          <circle cx="485" cy="250" r="2" fill="#E0C693" opacity="0.7" />
        </svg>

        {/* Seamless bottom transition into deep dark canvas */}
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-b from-transparent via-[#090D15]/75 to-[#090D15]" />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl flex flex-col items-center relative z-10 text-center pt-2 sm:pt-6 pb-20">
        
        {/* ========================================================= */}
        {/* 1. HERO HEADER (Astra copy verbatim) */}
        {/* ========================================================= */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.7, ease: easeTransition }}
          className="flex flex-col items-center justify-center space-y-2 max-w-2xl mx-auto mb-24 sm:mb-10 lg:mb-14 text-center relative"
        >
          {/* Subtle localized dark glow behind title to preserve 4.5:1+ contrast on glowing moon crown */}
          <div 
            className="absolute -inset-x-8 -inset-y-3 rounded-full bg-[#060911]/60 blur-xl -z-10 pointer-events-none" 
            aria-hidden="true" 
          />

          <h1 className="font-serif text-[38px] sm:text-6xl lg:text-[72px] text-[#F2EFE9] font-light tracking-[-0.02em] leading-[1.04] drop-shadow-[0_2px_12px_rgba(9,13,21,0.9)]">
            Зеркало себя
          </h1>
          <p className="font-serif text-lg sm:text-2xl lg:text-[25px] text-[#E0C693] font-light tracking-[0.01em] drop-shadow-[0_2px_8px_rgba(9,13,21,0.8)]">
            Посмотреть на знакомое иначе.
          </p>
        </motion.div>

        {/* ========================================================= */}
        {/* 2. THE TWO GATES (ДВЕ НЕЗАВИСИМЫЕ ДВЕРИ — ПЕРВЫЙ ЭКРАН) */}
        {/* ========================================================= */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16">
          
          {/* DOOR 1: PERSONAL MYTH */}
          <motion.article
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.7, delay: 0.1, ease: easeTransition }}
            className="relative flex flex-col justify-between p-5 sm:p-7 rounded-sm bg-[#090D16]/45 backdrop-blur-md border border-[rgba(200,164,93,0.22)] hover:border-[rgba(200,164,93,0.5)] transition-all duration-300 text-left group shadow-[0_8px_32px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.65),0_0_24px_rgba(200,164,93,0.12)]"
          >
            {/* Top decorative hairline */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C8A45D]/40 to-transparent" />
            
            <div className="flex flex-col flex-grow relative">
              {/* Local dark scrim under text ensuring contrast >= 4.5:1 against glowing moon background */}
              <div 
                className="absolute -inset-x-2 -inset-y-1.5 rounded-sm bg-[#060911]/75 backdrop-blur-sm -z-10 pointer-events-none border border-white/[0.03]" 
                aria-hidden="true" 
              />

              <div className="text-[11px] sm:text-xs uppercase font-sans tracking-[0.24em] text-[var(--color-antique-gold)] font-medium flex items-center gap-2 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_6px_rgba(200,164,93,0.6)]" />
                <span>Первый путь</span>
                <span className="flex-1 h-[1px] bg-white/10" />
              </div>

              <h2 className="font-serif text-2xl sm:text-[27px] text-[#F2EFE9] font-normal leading-[1.2] mb-2.5 group-hover:text-white transition-colors">
                История по вашей ситуации
              </h2>

              <p className="text-[14px] sm:text-[15px] text-[#CBD5E1] font-normal leading-[1.6] mb-5 flex-grow">
                Четыре вопроса о том, что происходит сейчас. Затем — личная история, в которой можно узнать знакомое переживание.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-white/[0.08] relative z-10">
              <button
                type="button"
                onClick={handleStartMyth}
                className="min-h-[44px] px-5 py-2.5 bg-[var(--color-antique-gold)] hover:bg-[#D9B770] text-[#090D15] text-[12px] font-semibold tracking-[0.16em] uppercase rounded-xs transition-all duration-200 inline-flex items-center justify-center text-center shadow-[0_2px_12px_rgba(200,164,93,0.25)] hover:shadow-[0_4px_20px_rgba(200,164,93,0.45)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-antique-gold)]"
              >
                Начать историю
              </button>
              <button
                type="button"
                onClick={() => setIsSampleStoryOpen(true)}
                className="min-h-[44px] px-3 py-2 text-[13px] text-[#E0C693] hover:text-white underline underline-offset-4 decoration-[rgba(200,164,93,0.4)] hover:decoration-[rgba(200,164,93,0.9)] transition-colors duration-200 inline-flex items-center justify-center text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-antique-gold)]"
              >
                Прочитать пример
              </button>
            </div>
          </motion.article>

          {/* DOOR 2: DIGITAL CODE */}
          <motion.article
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.7, delay: 0.2, ease: easeTransition }}
            className="relative flex flex-col justify-between p-5 sm:p-7 rounded-sm bg-[#090D16]/45 backdrop-blur-md border border-[rgba(200,164,93,0.22)] hover:border-[rgba(200,164,93,0.5)] transition-all duration-300 text-left group shadow-[0_8px_32px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.65),0_0_24px_rgba(200,164,93,0.12)]"
          >
            {/* Top decorative hairline */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C8A45D]/40 to-transparent" />
            
            <div className="flex flex-col flex-grow relative">
              {/* Local dark scrim under text ensuring contrast >= 4.5:1 against glowing moon background */}
              <div 
                className="absolute -inset-x-2 -inset-y-1.5 rounded-sm bg-[#060911]/75 backdrop-blur-sm -z-10 pointer-events-none border border-white/[0.03]" 
                aria-hidden="true" 
              />

              <div className="text-[11px] sm:text-xs uppercase font-sans tracking-[0.24em] text-[var(--color-antique-gold)] font-medium flex items-center gap-2 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_6px_rgba(200,164,93,0.6)]" />
                <span>Второй путь</span>
                <span className="flex-1 h-[1px] bg-white/10" />
              </div>

              <h2 className="font-serif text-2xl sm:text-[27px] text-[#F2EFE9] font-normal leading-[1.2] mb-2.5 group-hover:text-white transition-colors">
                Разбор по дате рождения
              </h2>

              <p className="text-[14px] sm:text-[15px] text-[#CBD5E1] font-normal leading-[1.6] mb-5 flex-grow">
                Пять сторон жизни через образы чисел: желания, поступки, способ действовать, окружение и то, что вы создаёте.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-white/[0.08] relative z-10">
              <button
                type="button"
                onClick={handleSelectCode}
                className="min-h-[44px] px-5 py-2.5 bg-[var(--color-antique-gold)] hover:bg-[#D9B770] text-[#090D15] text-[12px] font-semibold tracking-[0.16em] uppercase rounded-xs transition-all duration-200 inline-flex items-center justify-center text-center shadow-[0_2px_12px_rgba(200,164,93,0.25)] hover:shadow-[0_4px_20px_rgba(200,164,93,0.45)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-antique-gold)]"
              >
                Посмотреть свой разбор
              </button>
              <button
                type="button"
                onClick={handleSelectCodeSample}
                className="min-h-[44px] px-3 py-2 text-[13px] text-[#E0C693] hover:text-white underline underline-offset-4 decoration-[rgba(200,164,93,0.4)] hover:decoration-[rgba(200,164,93,0.9)] transition-colors duration-200 inline-flex items-center justify-center text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-antique-gold)]"
              >
                Посмотреть пример
              </button>
            </div>
          </motion.article>

        </div>

        {/* ========================================================= */}
        {/* 3. DRAFT & SAVED STATE RECOVERY */}
        {/* ========================================================= */}
        {transientDraft && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.7 }}
            className="w-full mb-8 p-6 sm:p-7 rounded-xs bg-[#0D121D] border border-[var(--color-border-gold)] shadow-[0_0_24px_rgba(200,164,93,0.08)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-border-gold)]/50 shrink-0 mt-0.5">
                <RotateCcw size={20} className="text-[var(--color-antique-gold)]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[12px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] font-medium">
                    Черновик сессии · В процессе
                  </span>
                  <span className="text-[12px] font-mono text-stone-400">
                    ({new Date(transientDraft.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})
                  </span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-1">
                  Найдено незавершённое зеркало
                </h3>
                <p className="text-[13px] text-stone-300 font-normal leading-relaxed max-w-lg">
                  {transientDraft.codeDate ? `Код: ${transientDraft.codeDate}` : ''}
                  {transientDraft.codeDate && (transientDraft.storyResult || transientDraft.storyInputs?.q1) ? ' · ' : ''}
                  {transientDraft.storyResult ? `Миф: «${transientDraft.storyResult.title}»` : (transientDraft.storyInputs?.q1 ? 'Ответы на вопросы мифа сохранены' : '')}
                  {transientDraft.meetingResult ? ' · Встреча зеркал готова' : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={onRestoreDraft}
                className="px-6 py-3 bg-[var(--color-antique-gold)] hover:bg-[#D9B770] text-gray-950 uppercase tracking-[0.2em] text-[13px] font-semibold rounded-xs transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span>Продолжить</span>
                <ChevronRight size={14} />
              </button>
              {onClearDraft && (
                <button
                  type="button"
                  onClick={onClearDraft}
                  title="Сбросить незавершённый черновик"
                  className="px-4 py-3 text-stone-400 hover:text-stone-200 uppercase tracking-widest text-[12px] font-mono transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Начать заново</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {savedSnapshot && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.7 }}
            className="w-full mb-8 p-6 sm:p-7 rounded-xs bg-[#0D121D] border border-[var(--color-border-gold)] shadow-[0_0_30px_rgba(200,164,93,0.1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-border-gold)] shrink-0 mt-0.5">
                <Bookmark size={20} className="text-[var(--color-antique-gold)]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[12px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] font-medium">
                    Моё зеркало · Сохранено локально
                  </span>
                  <span className="text-[12px] font-mono text-stone-400">
                    ({new Date(savedSnapshot.savedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })})
                  </span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-1">
                  Продолжить с того места
                </h3>
                <p className="text-[13px] text-stone-300 font-normal leading-relaxed max-w-lg">
                  {savedSnapshot.meetingUserNote
                    ? `Ваша заметка: «${savedSnapshot.meetingUserNote}»`
                    : savedSnapshot.storyResult?.title
                      ? `В Мифе остался образ «${savedSnapshot.storyResult.title}»`
                      : `Код ${savedSnapshot.codeDate}`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={onRestoreSavedMirror}
                className="px-6 py-3 bg-[var(--color-antique-gold)] hover:bg-[#D9B770] text-gray-950 uppercase tracking-[0.2em] text-[13px] font-semibold rounded-xs transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span>Продолжить с того места</span>
                <ChevronRight size={14} />
              </button>
              {onDeleteSavedMirror && (
                <button
                  type="button"
                  onClick={onDeleteSavedMirror}
                  title="Удалить сохранённое зеркало из браузера"
                  className="px-3 py-3 text-stone-400 hover:text-red-300 uppercase tracking-widest text-[12px] font-mono transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span className="sm:hidden">Удалить сохранённое</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 4. SYNTHESIS BANNER (MEETING OF MIRRORS) */}
        {/* ========================================================= */}
        {meetingAvailable && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.8, delay: 0.3 }}
            onClick={handleMeeting}
            className={`w-full p-6 sm:p-8 rounded-xs border transition-all duration-700 flex flex-col sm:flex-row items-center justify-between gap-6 text-left mb-8 ${
              isMeetingReady
                ? 'bg-[var(--color-bg-surface)] border-[var(--color-border-gold)] shadow-[0_0_30px_rgba(200,164,93,0.1)] cursor-pointer hover:border-[var(--color-antique-gold)]'
                : 'bg-[var(--color-bg-surface)]/50 border-[var(--color-border-subtle)] cursor-pointer hover:border-[var(--color-border-gold)]'
            }`}
          >
            <div className="flex items-center gap-5 sm:gap-6">
              <div className="flex -space-x-3 shrink-0">
                <Orb number={codeResult?.soul || 1} size={42} glow={false} />
                <Orb number={7} size={42} glow={false} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light">
                    Встреча Зеркал
                  </span>
                  {isMeetingReady && (
                    <span className="text-[12px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-border-gold)] text-[var(--color-antique-gold)]">
                      Готово к синтезу
                    </span>
                  )}
                </div>
                <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] font-normal mt-1 max-w-lg leading-relaxed">
                  Сопоставление двух независимых отражений: поиск параллелей, честное осмысление расхождений и синтез-вопрос.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono whitespace-nowrap shrink-0">
              <span>{isMeetingReady ? 'Провести встречу →' : 'Узнать больше →'}</span>
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 5. PANTHEON TEASER */}
        {/* ========================================================= */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.8, delay: 0.4 }}
          className="w-full pt-10 border-t border-[var(--color-border-subtle)] flex flex-col items-center mb-8"
        >
          <div className="flex items-center justify-between w-full mb-6">
            <div className="text-left">
              <span className="text-[12px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-1">
                Канон Вяземского
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light">
                Что означают числа
              </h3>
            </div>

            <button
              type="button"
              onClick={handlePantheon}
              className="text-[12px] uppercase font-mono tracking-[0.2em] text-[var(--color-antique-gold)] hover:underline transition-colors cursor-pointer"
            >
              Открыть раздел →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full text-left">
            {[
              { num: 1, name: 'Солнце · Сурья', desc: 'Единица. Первоисточник воли, прямое действие, авторство своей жизни.' },
              { num: 6, name: 'Венера · Шукра', desc: 'Шестёрка. Гармония, эстетическое мастерство, глубина формы и чувств.' },
              { num: 8, name: 'Сатурн · Шани', desc: 'Восьмёрка. Масштабные структуры, закон времени, терпение и весомость.' }
            ].map((arch) => (
              <div 
                key={arch.num}
                onClick={handlePantheon}
                className="p-5 sm:p-6 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-gold)] transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Orb number={arch.num} size={38} glow={false} />
                  <span className="font-serif text-lg text-[var(--color-text-primary)]">{arch.name}</span>
                </div>
                <p className="text-[13px] text-[var(--color-text-secondary)] font-normal leading-relaxed">
                  {arch.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Project Footer Disclaimer */}
        <footer className="w-full pt-12 pb-4 border-t border-[var(--color-border-subtle)] text-center">
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
            Информационно-развлекательный проект для самопознания. Личные истории и ответы Альберта создаются с помощью ИИ. Разборы и истории не являются консультацией или прогнозом.
          </p>
        </footer>

      </div>

      {/* Embedded Modals */}
      <PantheonModal
        isOpen={isPantheonOpen}
        onClose={() => setIsPantheonOpen(false)}
      />

      <SampleStoryModal
        isOpen={isSampleStoryOpen}
        onClose={() => setIsSampleStoryOpen(false)}
      />

    </div>
  );
}

export default LabEntryView;
