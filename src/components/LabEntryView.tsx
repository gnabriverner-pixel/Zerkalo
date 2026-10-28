import { DateConsentField } from './DateConsentField';
import { useDateConsentGate } from './useDateConsentGate';
import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Bookmark, RotateCcw, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { Orb } from './Orb';
import { PantheonModal } from './PantheonModal';
import { SampleStoryModal } from './SampleStoryModal';
import { Term } from './Term';
import { GLOSSARY_PLANETS } from '../data/glossary';
import { CalculationResult, ApiResponse } from '../types';
import { validateBirthDate } from '../services/birthDate';
import { MyMirrorSnapshotV1, TransientDraftV1 } from '../services/myMirrorStorage';
import mirrorHero from '../assets/mirror-hero.jpg';
import mirrorHeroWebp from '../assets/mirror-hero.webp';
import mirrorHeroMobile from '../assets/mirror-hero-mobile.webp';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface LabEntryViewProps {
  meetingAvailable?: boolean;
  onSelectMyth?: () => void;
  onSelectCode?: (initialDate?: string, options?: { autoCalculate?: boolean; isExample?: boolean; samplePayload?: any }) => void;
  onSelectMeeting?: () => void;
  onOpenPantheon?: () => void;
  onSelectMode?: (mode: 'entry' | 'code' | 'myth' | 'meeting' | 'ab-test', initialDate?: string, options?: { autoCalculate?: boolean; isExample?: boolean; samplePayload?: any }) => void;
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

export function parsePastedDate(raw: string): { day: string; month: string; year: string } {
  const digits = raw.replace(/\D/g, '');
  const day = digits.slice(0, 2);
  const rest = digits.slice(2);
  const month = rest ? rest.slice(0, 2) : '';
  const year = rest.length > 2 ? rest.slice(2, 6) : '';
  return { day, month, year };
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
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [dateError, setDateError] = useState('');
  const [isPantheonOpen, setIsPantheonOpen] = useState(false);
  const [isSampleStoryOpen, setIsSampleStoryOpen] = useState(false);
  const consentGate = useDateConsentGate();

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const shouldReduceMotion = usePrefersReducedMotion();
  const easeTransition = [0.16, 1, 0.3, 1] as const;

  const hasCode = hasCodeResult !== undefined ? hasCodeResult : !!codeResult;
  const hasMyth = hasMythResult !== undefined ? hasMythResult : !!storyResult;
  const isMeetingReady = hasCode && hasMyth;

  // Pasted or quickly typed dates ("14.03.1987", "14031987") overflow into the next fields instead of being cut off.
  const fillDateFrom = (field: 'day' | 'month', raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setDateError('');
    if (field === 'day') {
      const parsed = parsePastedDate(raw);
      setDay(parsed.day);
      if (parsed.month) setMonth(parsed.month);
      if (parsed.year) setYear(parsed.year);
      if (digits.length > 4) yearRef.current?.focus();
      else if (digits.length >= 2) monthRef.current?.focus();
      return;
    }
    setMonth(digits.slice(0, 2));
    if (digits.length > 2) setYear(digits.slice(2, 6));
    if (digits.length >= 2) yearRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData('text');
    if (text) {
      e.preventDefault();
      fillDateFrom('day', text);
    }
  };

  const handleMonthPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData('text');
    if (text) {
      e.preventDefault();
      fillDateFrom('month', text);
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => fillDateFrom('day', e.target.value);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => fillDateFrom('month', e.target.value);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(val);
    setDateError('');
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'day' | 'month' | 'year'
  ) => {
    if (e.key === 'Backspace') {
      if (field === 'year' && year.length === 0 && monthRef.current) {
        monthRef.current.focus();
      } else if (field === 'month' && month.length === 0 && dayRef.current) {
        dayRef.current.focus();
      }
    } else if (e.key === 'Enter') {
      handleCodeSubmit();
    }
  };

  const handleCodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!day || !month || !year) {
      setDateError('Введите полную дату рождения (ДД · ММ · ГГГГ)');
      return;
    }
    const validation = validateBirthDate(day.padStart(2, '0'), month.padStart(2, '0'), year);
    if (!validation.valid) {
      setDateError('message' in validation ? validation.message : 'Проверьте правильность введённой даты');
      return;
    }
    const formatted = validation.formatted;
    // The mark under the date is the consent: without it (or an earlier valid one) the date does not leave this form.
    const problem = await consentGate.confirm();
    if (problem) {
      setDateError(problem);
      return;
    }
    if (onSelectCode) {
      onSelectCode(formatted, { autoCalculate: true });
    } else if (onSelectMode) {
      onSelectMode('code', formatted, { autoCalculate: true });
    }
  };

  const handleStartMyth = () => {
    if (onSelectMyth) onSelectMyth();
    else if (onSelectMode) onSelectMode('myth');
  };

  const handleSelectCodeSample = async () => {
    let payload: any = null;
    try {
      const resp = await fetch('/examples/code-v2-14031987.json');
      if (resp.ok) {
        const data = await resp.json();
        payload = data.payload || data;
      }
    } catch {
      // fallback if fetch is not available
    }
    if (!payload) {
      try {
        const fallback = await import('../../public/examples/code-v2-14031987.json');
        payload = (fallback as any).default?.payload || (fallback as any).payload || (fallback as any).default || fallback;
      } catch {
        // no-op
      }
    }
    if (onSelectCode) {
      onSelectCode('14.03.1987', { isExample: true, samplePayload: payload });
    } else if (onSelectMode) {
      onSelectMode('code', '14.03.1987', { isExample: true, samplePayload: payload });
    }
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
      {/* Background Moon & Sacred Geometry restricted strictly to the first hero viewport */}
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
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-[#090D15]/80 to-[#090D15]" />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl flex flex-col items-center relative z-10 text-center pt-2 sm:pt-4 pb-20">
        
        {/* ========================================================= */}
        {/* 1. HERO HEADER (FIRST SCREEN PROPORTIONS & ASTRA 058 TEXT) */}
        {/* ========================================================= */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.85, ease: easeTransition }}
          className="min-h-[76vh] sm:min-h-[82vh] lg:min-h-[86vh] flex flex-col items-center justify-center space-y-4 max-w-3xl mx-auto pt-8 sm:pt-14 pb-12 text-center relative"
        >
          {/* Subtle localized dark glow behind title to preserve 4.5:1+ contrast on glowing moon crown */}
          <div 
            className="absolute -inset-x-8 -inset-y-3 rounded-full bg-[#060911]/60 blur-xl -z-10 pointer-events-none" 
            aria-hidden="true" 
          />

          <h1 className="font-serif text-[56px] sm:text-7xl lg:text-[88px] text-[var(--color-text-primary)] font-light tracking-tight leading-[0.96] drop-shadow-[0_2px_14px_rgba(9,13,21,0.95)]">
            Зеркало себя
          </h1>

          <h2 className="font-serif text-2xl sm:text-3xl text-[var(--color-antique-gold)] font-light mt-1 drop-shadow-[0_2px_10px_rgba(9,13,21,0.9)]">
            Посмотреть на знакомое иначе.
          </h2>

          <p className="text-[var(--color-text-secondary)] font-normal text-[17px] sm:text-[18px] max-w-2xl mx-auto leading-[1.7] pt-2">
            Начните с даты рождения: пять сторон жизни через истории и вопросы.
          </p>
          <p className="text-[var(--color-text-muted)] text-[13px] sm:text-sm max-w-2xl mx-auto leading-relaxed" data-testid="entry-promise">
            Ответы видите только вы. Решение об оплате — после того, как увидите пример.
          </p>

          <a
            href="#date-gate"
            className="mt-6 inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.25em] text-[var(--color-antique-gold)] font-mono hover:text-white transition-colors cursor-pointer group"
          >
            <span>Выбрать, с чего начать</span>
            <ChevronDown size={15} className="transition-transform group-hover:translate-y-0.5" />
          </a>
        </motion.div>

        {/* ========================================================= */}
        {/* 2. THE TWO GATES (ДВЕ НЕЗАВИСИМЫЕ ДВЕРИ — ПРЕЖНИЙ СВЕТ) */}
        {/* ========================================================= */}
        <section id="gates" className="w-full max-w-4xl mx-auto scroll-mt-20 pt-4 sm:pt-8 mb-16">
          {/* Albert lead before cards */}
          <div className="max-w-2xl mx-auto mb-10 pl-5 border-l-2 border-[var(--color-antique-gold)]/60 text-left">
            <span className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono block mb-1 font-medium">
              Альберт — ИИ-собеседник
            </span>
            <p className="font-serif italic text-lg sm:text-[20px] text-stone-200 leading-relaxed font-light">
              Начните с даты: так проще увидеть, как здесь всё устроено. Личный миф можно открыть и сразу.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* DOOR 1: DIGITAL CODE */}
            <motion.article
              id="date-gate"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.8, delay: 0.15 }}
              className="group relative flex flex-col items-center justify-between p-8 sm:p-10 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-gold)] transition-all duration-500 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            >
              <div className="flex flex-col items-center w-full">
                <span className="text-[13px] uppercase font-mono tracking-[0.3em] text-[var(--color-text-muted)] mb-6">
                  Первый путь
                </span>

                <div className="my-2 transition-transform duration-700 group-hover:scale-105">
                  <Orb number={1} size={150} glow={true} />
                </div>

                <h2 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light mt-6 mb-3">
                  Разбор по дате рождения
                </h2>

                <p className="text-sm text-[var(--color-text-secondary)] font-normal leading-relaxed max-w-xs mb-3">
                  Пять сторон жизни через образы чисел: желания, поступки, способ действовать, окружение и то, что вы создаёте.
                </p>

                <p className="text-[13px] text-stone-300 font-normal leading-relaxed mb-5 max-w-xs mx-auto">
                  Для разбора нужна дата рождения. По правилам проекта из неё получатся пять чисел — по одному для каждой роли.
                </p>

                {/* THREE CLEAN DATE FIELDS: [ ДД ] [ ММ ] [ ГГГГ ] */}
                <form onSubmit={handleCodeSubmit} className="w-full flex flex-col items-center space-y-4 mb-2">
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <div className="relative">
                      <input
                        ref={dayRef}
                        id="birth-day"
                        type="text"
                        inputMode="numeric"
                        placeholder="ДД"
                        value={day}
                        onChange={handleDayChange}
                        onPaste={handlePaste}
                        onKeyDown={(e) => handleKeyDown(e, 'day')}
                        className="w-16 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl sm:text-[26px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                        aria-label="День рождения"
                      />
                    </div>
                    <span className="text-[var(--color-text-muted)] font-serif text-xl select-none">·</span>
                    <div className="relative">
                      <input
                        ref={monthRef}
                        id="birth-month"
                        type="text"
                        inputMode="numeric"
                        placeholder="ММ"
                        value={month}
                        onChange={handleMonthChange}
                        onPaste={handleMonthPaste}
                        onKeyDown={(e) => handleKeyDown(e, 'month')}
                        className="w-16 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl sm:text-[26px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                        aria-label="Месяц рождения"
                      />
                    </div>
                    <span className="text-[var(--color-text-muted)] font-serif text-xl select-none">·</span>
                    <div className="relative">
                      <input
                        ref={yearRef}
                        id="birth-year"
                        type="text"
                        inputMode="numeric"
                        placeholder="ГГГГ"
                        maxLength={4}
                        value={year}
                        onChange={handleYearChange}
                        onKeyDown={(e) => handleKeyDown(e, 'year')}
                        className="w-24 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl sm:text-[26px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                        aria-label="Год рождения"
                      />
                    </div>
                  </div>

                  {consentGate.showMark && (
                    <DateConsentField checked={consentGate.checked} onChange={value => { consentGate.setChecked(value); if (value) setDateError(''); }} />
                  )}

                  {dateError && (
                    <span className="text-[13px] text-red-300 font-light block">{dateError}</span>
                  )}

                  <div className="w-full pt-4 border-t border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                    <button
                      type="submit"
                      className="min-h-11 px-6 py-2.5 bg-[var(--color-antique-gold)] hover:bg-[#D9B770] text-[#090D15] rounded-xs uppercase tracking-[0.18em] text-[13px] font-semibold transition-all cursor-pointer shadow-[0_2px_12px_rgba(200,164,93,0.2)]"
                    >
                      Посмотреть свой разбор
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectCodeSample}
                      className="min-h-11 px-5 py-2.5 border border-[var(--color-border-gold)] bg-transparent hover:bg-white/5 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.16em] text-[12px] font-medium transition-all cursor-pointer"
                    >
                      Посмотреть пример
                    </button>
                  </div>
                </form>
              </div>
            </motion.article>

            {/* DOOR 2: PERSONAL MYTH */}
            <motion.article
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.8, delay: 0.25 }}
              className="group relative flex flex-col items-center justify-between p-8 sm:p-10 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-gold)] transition-all duration-500 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            >
              <div className="flex flex-col items-center w-full">
                <span className="text-[13px] uppercase font-mono tracking-[0.3em] text-[var(--color-text-muted)] mb-6">
                  Второй путь
                </span>

                <div className="my-2 transition-transform duration-700 group-hover:scale-105">
                  <Orb number={7} size={150} showNumber={false} glow={true} />
                </div>

                <h2 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light mt-6 mb-3">
                  Личный миф
                </h2>

                <p className="text-sm text-[var(--color-text-secondary)] font-normal leading-relaxed max-w-xs mb-8">
                  Художественная история по вашим ответам о том, что происходит с вами сейчас.
                </p>
              </div>

              <div className="w-full pt-6 border-t border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleStartMyth}
                  className="min-h-11 px-6 py-2.5 bg-[var(--color-antique-gold)] hover:bg-[#D9B770] text-[#090D15] rounded-xs uppercase tracking-[0.18em] text-[13px] font-semibold transition-all cursor-pointer shadow-[0_2px_12px_rgba(200,164,93,0.2)]"
                >
                  {hasMyth ? 'Открыть историю' : 'Начать Личный миф'}
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/primer-lichnogo-mifa'; }}
                  className="min-h-11 px-5 py-2.5 border border-[var(--color-border-gold)] bg-transparent hover:bg-white/5 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.16em] text-[12px] font-medium transition-all cursor-pointer"
                >
                  Прочитать пример
                </button>
              </div>
            </motion.article>
          </div>
        </section>

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
                    Продолжить разбор
                  </span>
                  <span className="text-[12px] font-mono text-stone-400">
                    ({new Date(transientDraft.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})
                  </span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-1">
                  {transientDraft.codeDate 
                    ? `Вы не закончили разбор от ${transientDraft.codeDate}. Продолжим?` 
                    : 'Вы не закончили разбор. Продолжим?'}
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
        {/* 5. WORLD OF NINE PLANETS (МИР ДЕВЯТИ СВЕТИЛ — ASTRA 058) */}
        {/* ========================================================= */}
        <motion.section
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.8, delay: 0.35 }}
          className="w-full pt-10 border-t border-[var(--color-border-subtle)] flex flex-col items-center mb-12"
        >
          <div className="w-full text-center max-w-2xl mx-auto mb-10">
            <span className="text-[13px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-2 font-medium">
              Знакомство с миром
            </span>
            <h3 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light">
              Мир девяти светил
            </h3>
          </div>

          {/* Three Steps verbatim per Astra 058 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mb-10">
            {/* Step I */}
            <div className="p-6 sm:p-7 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <div>
                <span className="font-serif text-2xl text-[var(--color-antique-gold)] font-light block mb-2">I</span>
                <h4 className="font-serif text-xl text-stone-100 font-normal mb-3">Небо, полное характеров.</h4>
                <p className="text-sm text-stone-300 leading-relaxed font-normal">
                  В мире «Зеркала» у света есть характер. <Term planet={1}>Солнце</Term> напоминает о первом шаге, <Term planet={2}>Луна</Term> — о близости, <Term planet={8}>Сатурн</Term> — о том, что требует времени. Эти образы помогают начать разговор о знакомых вещах: желаниях, поступках, отношениях.
                </p>
              </div>
            </div>

            {/* Step II */}
            <div className="p-6 sm:p-7 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <div>
                <span className="font-serif text-2xl text-[var(--color-antique-gold)] font-light block mb-2">II</span>
                <h4 className="font-serif text-xl text-stone-100 font-normal mb-3">Свет и тень.</h4>
                <p className="text-sm text-stone-300 leading-relaxed font-normal">
                  Здесь девять образов. Среди них есть знакомые <Term planet={1}>Солнце</Term> и <Term planet={2}>Луна</Term>, а есть <Term planet={4}>Раху</Term> и <Term planet={7}>Кету</Term> — два непривычных имени. В нашем разборе Раху помогает говорить о тяге к новому, Кету — о тишине и внимании к сути. Нажмите на имя, чтобы познакомиться с образом.
                </p>
              </div>
            </div>

            {/* Step III */}
            <div className="p-6 sm:p-7 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <div>
                <span className="font-serif text-2xl text-[var(--color-antique-gold)] font-light block mb-2">III</span>
                <h4 className="font-serif text-xl text-stone-100 font-normal mb-3">Число как свет.</h4>
                <p className="text-sm text-stone-300 leading-relaxed font-normal">
                  По принятым в проекте правилам из даты рождения получаются пять чисел. Каждому соответствует образ: свет, при котором мы рассматриваем одну сторону жизни. Дальше — истории и вопросы. Что в них знакомо, решаете вы.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('gates');
                el?.scrollIntoView({ behavior: 'smooth' });
                dayRef.current?.focus();
              }}
              className="min-h-11 px-7 py-3 bg-[var(--color-antique-gold)] hover:bg-[#D9B770] text-[#090D15] rounded-xs uppercase tracking-[0.18em] text-[13px] font-semibold transition-all cursor-pointer shadow-[0_2px_12px_rgba(200,164,93,0.2)]"
            >
              Посмотреть свои пять чисел
            </button>
          </div>

          {/* Ribbon of Nine Luminaries */}
          <div className="w-full pt-8 border-t border-[var(--color-border-subtle)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="text-left">
                <span className="text-[12px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-1">
                  Девять образов традиции
                </span>
                <h4 className="font-serif text-xl sm:text-2xl text-[var(--color-text-primary)] font-light">
                  <Term term="светила (граха)">Светила</Term> и их свет
                </h4>
              </div>

              <button
                type="button"
                onClick={handlePantheon}
                className="text-[12px] uppercase font-mono tracking-[0.2em] text-[var(--color-antique-gold)] hover:underline transition-colors cursor-pointer"
              >
                Открыть все 9 ключей →
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2.5 sm:gap-3 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const p = GLOSSARY_PLANETS[num];
                return (
                  <div
                    key={num}
                    className="p-3 sm:p-3.5 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-gold)] transition-all flex flex-col items-center text-center group cursor-pointer"
                    onClick={handlePantheon}
                  >
                    <div className="mb-2 transition-transform duration-300 group-hover:scale-105">
                      <Orb number={num} size={44} glow={false} />
                    </div>
                    <span className="font-serif text-[15px] sm:text-base text-stone-100 block leading-tight">
                      <Term planet={num}>{p.title.split(' · ')[0]}</Term>
                    </span>
                    <span className="text-[11px] font-mono text-[var(--color-antique-gold)]/80 mt-1 block">
                      {num}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

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
