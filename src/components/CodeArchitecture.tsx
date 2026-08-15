import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  ChevronDown, 
  Loader2, 
  RotateCcw, 
  GitFork,
  Send,
  MessageSquare
} from 'lucide-react';
import { CalculationResult, FirstMirror, ApiResponse } from '../types';
import { calculateDigitalCode } from '../services/calculator';
import { generateFirstMirror } from '../services/interpretation';
import { numberKnowledge } from '../data/numberKnowledge';
import { PASSPORT_PRACTICES } from '../data/passportPractices';
import { Orb, PLANET_PALETTES } from './Orb';
import { AlbertDialogue } from './AlbertDialogue';

interface CodeArchitectureProps {
  initialDate?: string;
  onOpenAbout?: () => void;
  onCodeCalculated?: (calc: CalculationResult, reading?: FirstMirror) => void;
  onNavigateToMeeting?: () => void;
  hasMythResult?: boolean;
}

export default function CodeArchitecture({ 
  initialDate = '',
  onOpenAbout,
  onCodeCalculated,
  onNavigateToMeeting,
  hasMythResult
}: CodeArchitectureProps = {}) {
  const [day, setDay] = useState(initialDate ? initialDate.split('.')[0] || '' : '');
  const [month, setMonth] = useState(initialDate ? initialDate.split('.')[1] || '' : '');
  const [year, setYear] = useState(initialDate ? initialDate.split('.')[2] || '' : '');
  const [dateError, setDateError] = useState('');
  
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [reading, setReading] = useState<FirstMirror | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [consentChecked, setConsentChecked] = useState(true);
  const [isAlbertOpen, setIsAlbertOpen] = useState(false);

  // Section references for smooth editorial manuscript scrolling
  const sectionIntroRef = useRef<HTMLDivElement>(null);
  const sectionSoulRef = useRef<HTMLDivElement>(null);
  const sectionExpressionRef = useRef<HTMLDivElement>(null);
  const sectionCouplingRef = useRef<HTMLDivElement>(null);
  const sectionPathRef = useRef<HTMLDivElement>(null);
  const sectionTensionRef = useRef<HTMLDivElement>(null);
  const sectionFullMapRef = useRef<HTMLDivElement>(null);
  const sectionAlbertRef = useRef<HTMLDivElement>(null);

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const executeCalculation = async (fullDate: string) => {
    const calc = calculateDigitalCode(fullDate);
    setResult(calc);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'code', date: fullDate, calc })
      });
      const data: ApiResponse = await res.json();
      if (data.status === 'ok' && data.code_result?.first_mirror) {
        setReading(data.code_result.first_mirror);
      } else {
        setReading(data.code_result?.first_mirror || generateFirstMirror(calc));
      }
    } catch (err) {
      console.error(err);
      setReading(generateFirstMirror(calc));
    } finally {
      setIsGenerating(false);
      if (onCodeCalculated) {
        onCodeCalculated(calc, reading || undefined);
      }
    }
  };

  useEffect(() => {
    if (initialDate && initialDate.length === 10 && !result) {
      const parts = initialDate.split('.');
      if (parts.length === 3) {
        setDay(parts[0]);
        setMonth(parts[1]);
        setYear(parts[2]);
        executeCalculation(initialDate);
      }
    }
  }, [initialDate]);

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDay(val);
    setDateError('');
    if (val.length === 2 && monthRef.current) {
      monthRef.current.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMonth(val);
    setDateError('');
    if (val.length === 2 && yearRef.current) {
      yearRef.current.focus();
    }
  };

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
      handleCalculate();
    }
  };

  const handleCalculate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!consentChecked) return;
    setDateError('');

    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (day.length === 2 && month.length === 2 && year.length === 4 && d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2099) {
      const fullDate = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
      executeCalculation(fullDate);
    } else {
      setDateError('Проверьте день, месяц и год (ДД.ММ.ГГГГ)');
    }
  };

  const handleReset = () => {
    setResult(null);
    setReading(null);
    setDay('');
    setMonth('');
    setYear('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const soulNum = result ? result.soul : 1;
  const exprNum = result ? result.expression : 1;
  const pathNum = result ? result.path : 1;
  const dirNum = result ? result.direction : 1;
  const resNum = result ? result.result : 1;

  const soulInfo = numberKnowledge[soulNum] || numberKnowledge[1];
  const exprInfo = numberKnowledge[exprNum] || numberKnowledge[1];
  const pathInfo = numberKnowledge[pathNum] || numberKnowledge[1];
  const dirInfo = numberKnowledge[dirNum] || numberKnowledge[1];
  const resInfo = numberKnowledge[resNum] || numberKnowledge[1];

  const soulPalette = PLANET_PALETTES[soulNum] || PLANET_PALETTES[1];
  const exprPalette = PLANET_PALETTES[exprNum] || PLANET_PALETTES[1];
  const pathPalette = PLANET_PALETTES[pathNum] || PLANET_PALETTES[1];

  const soulPractice = PASSPORT_PRACTICES[soulNum] || PASSPORT_PRACTICES[1];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-12 px-4 sm:px-6 lg:px-8 text-[var(--color-text-primary)] font-sans relative overflow-x-hidden w-full selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      
      {/* ========================================================= */}
      {/* 1. INITIAL FORM SCREEN (When no result yet) */}
      {/* ========================================================= */}
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center w-full max-w-xl mx-auto py-8 my-auto"
        >
          <div className="flex justify-center mb-8">
            <Orb number={1} size={150} glow={true} />
          </div>

          <span className="text-[11px] uppercase tracking-[0.35em] text-[var(--color-antique-gold)] font-mono block mb-3 opacity-90">
            Линза II · Цифровой Код
          </span>

          <h1 className="font-serif text-5xl sm:text-6xl text-[var(--color-text-primary)] mb-4 font-light tracking-tight leading-tight">
            Архитектура природы
          </h1>

          <p className="text-[17px] text-[var(--color-text-secondary)] leading-relaxed mb-10 max-w-md mx-auto font-light">
            Введите дату рождения. Система рассчитает пять главных ключей и развернет их в непрерывном цифровом свитке.
          </p>

          {/* THREE CLEAN DATE FIELDS: [ ДД ] [ ММ ] [ ГГГГ ] */}
          <form onSubmit={handleCalculate} className="w-full flex flex-col items-center space-y-6">
            
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="relative">
                <input
                  ref={dayRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ДД"
                  maxLength={2}
                  value={day}
                  onChange={handleDayChange}
                  onKeyDown={(e) => handleKeyDown(e, 'day')}
                  className="w-16 sm:w-20 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                />
              </div>
              <span className="text-[var(--color-text-muted)] font-serif text-2xl">·</span>
              <div className="relative">
                <input
                  ref={monthRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ММ"
                  maxLength={2}
                  value={month}
                  onChange={handleMonthChange}
                  onKeyDown={(e) => handleKeyDown(e, 'month')}
                  className="w-16 sm:w-20 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                />
              </div>
              <span className="text-[var(--color-text-muted)] font-serif text-2xl">·</span>
              <div className="relative">
                <input
                  ref={yearRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ГГГГ"
                  maxLength={4}
                  value={year}
                  onChange={handleYearChange}
                  onKeyDown={(e) => handleKeyDown(e, 'year')}
                  className="w-24 sm:w-28 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                />
              </div>
            </div>

            {dateError && (
              <p className="text-xs text-red-300 font-light">{dateError}</p>
            )}

            <button
              type="submit"
              disabled={isGenerating || day.length !== 2 || month.length !== 2 || year.length !== 4}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold disabled:opacity-30 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Рассчитываем карту...</span>
                </>
              ) : (
                <>
                  <span>Рассчитать код</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            {/* Consent & About */}
            <div className="pt-2 flex items-center justify-center gap-4 text-xs text-[var(--color-text-muted)] font-light">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="accent-[var(--color-antique-gold)]"
                />
                <span>Согласен с обработкой</span>
              </label>
              {onOpenAbout && (
                <button
                  type="button"
                  onClick={onOpenAbout}
                  className="text-[var(--color-antique-gold)] hover:underline"
                >
                  О каноне
                </button>
              )}
            </div>

          </form>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* 2. EDITORIAL DIGITAL MANUSCRIPT SCROLL (When result calculated) */}
      {/* ========================================================= */}
      {result && (
        <div className="w-full max-w-4xl flex flex-col items-center relative z-10 space-y-28 sm:space-y-36 pb-24">
          
          {/* ------------------------------------------------------- */}
          {/* SECTION 1: HERO MANUSCRIPT HEADER */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionIntroRef}
            className="w-full min-h-[70vh] flex flex-col items-center justify-center text-center pt-8 pb-12 border-b border-[var(--color-border-subtle)]"
          >
            <span className="text-[11px] uppercase tracking-[0.35em] text-[var(--color-antique-gold)] font-mono block mb-4 opacity-90">
              Цифровой манускрипт · Карта природы
            </span>

            <h1 className="font-serif text-6xl sm:text-7xl lg:text-[84px] text-[var(--color-antique-gold)] font-light tracking-tight leading-none mb-6">
              {`${day}.${month}.${year}`}
            </h1>

            <p className="font-serif italic text-xl sm:text-2xl text-[var(--color-text-secondary)] max-w-xl mx-auto leading-relaxed font-light mb-12">
              «Числа не предопределяют судьбу, но очерчивают контуры силы, точки напряжения и естественные траектории движения.»
            </p>

            <button
              onClick={() => scrollTo(sectionSoulRef)}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Первый ключ: Кто вы внутри</span>
              <ChevronDown size={14} />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* SECTION 2: ПЕРВЫЙ КЛЮЧ (ДУША / КТО ВЫ ВНУТРИ) */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionSoulRef}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block">
              Ключ I · Число Души
            </span>

            {/* 220px Radiant Orb with slow 90s rotation */}
            <div className="my-2">
              <Orb number={soulNum} size={220} glow={true} />
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">
                <span>{soulPalette.name}</span>
                <span>·</span>
                <span className="text-[var(--color-antique-gold)]">{soulPalette.sanskrit}</span>
                <span>·</span>
                <span>Состав: {result.soulComposite}</span>
              </div>

              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                {soulInfo.archetypeName} ({soulNum})
              </h2>

              <p className="font-serif italic text-xl sm:text-2xl text-[#D8D2C4] leading-relaxed font-light pt-2">
                «{soulInfo.positions.soul.essence}»
              </p>
            </div>

            {/* In-depth manifestation text */}
            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 block mb-2">
                  Сила ядра
                </span>
                <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                  {soulInfo.positions.soul.strength}
                </p>
              </div>

              <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 block mb-2">
                  Внутренний запрос
                </span>
                <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                  {soulInfo.positions.soul.tension}
                </p>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionExpressionRef)}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Как вы действуете: Число Выражения</span>
              <ChevronDown size={14} />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* SECTION 3: ВТОРОЙ КЛЮЧ (ДЕЙСТВИЕ / ЧИСЛО ВЫРАЖЕНИЯ) */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionExpressionRef}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block">
              Ключ II · Число Выражения
            </span>

            <div className="my-2">
              <Orb number={exprNum} size={180} glow={true} />
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">
                <span>{exprPalette.name}</span>
                <span>·</span>
                <span className="text-[var(--color-antique-gold)]">{exprPalette.sanskrit}</span>
                <span>·</span>
                <span>Состав: {result.expressionComposite}</span>
              </div>

              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Паттерн проявления ({exprNum})
              </h2>

              <p className="font-serif italic text-xl sm:text-2xl text-[#D8D2C4] leading-relaxed font-light pt-2">
                «{exprInfo.positions.expression.essence}»
              </p>
            </div>

            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 block mb-2">
                  Как вас считывает среда
                </span>
                <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                  {exprInfo.positions.expression.strength}
                </p>
              </div>

              <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-antique-gold)] block mb-2">
                  Точность контакта
                </span>
                <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                  {exprInfo.positions.expression.recommendation}
                </p>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionCouplingRef)}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Что происходит, когда они встречаются</span>
              <ChevronDown size={14} />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* SECTION 4: СОЕДИНЕНИЕ (ВСТРЕЧА ДВУХ СИЛ: ДУША + ВЫРАЖЕНИЕ) */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionCouplingRef}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12 p-8 sm:p-12 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block">
              Сопряжение сил · Диалог Ядра и Формы
            </span>

            {/* TWO ORBS SIDE BY SIDE */}
            <div className="flex items-center justify-center gap-8 sm:gap-14 my-4">
              <div className="flex flex-col items-center gap-2">
                <Orb number={soulNum} size={110} glow={false} />
                <span className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  Душа {soulNum}
                </span>
              </div>

              <span className="font-serif text-3xl text-[var(--color-antique-gold)] font-light">·</span>

              <div className="flex flex-col items-center gap-2">
                <Orb number={exprNum} size={110} glow={false} />
                <span className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  Выражение {exprNum}
                </span>
              </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-4 text-left sm:text-center">
              <h3 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light">
                {soulNum === exprNum 
                  ? 'Монолитный резонанс: Единая природа'
                  : `Тандем двух начал: ${soulInfo.archetypeName} и ${exprInfo.archetypeName}`}
              </h3>

              <p className="text-[16px] sm:text-[17px] text-[var(--color-text-secondary)] font-light leading-relaxed pt-2">
                {soulNum === exprNum
                  ? 'Когда число Души и число Выражения совпадают, внутренняя мотивация абсолютно совпадает с внешним проявлением. Нет зазора между тем, кто вы внутри, и тем, как вас воспринимают окружающие. Это даёт монолитность, но требует гибкости в адаптации.'
                  : `Внутри вас действует импульс архетипа ${soulInfo.archetypeName} (${soulInfo.planet}), тогда как в мир вы выходите через язык архетипа ${exprInfo.archetypeName} (${exprPalette.name}). Это создает объемную многослойность: глубокая суть формулируется на более мягком или, напротив, более структурированном языке.`}
              </p>
            </div>

            <button
              onClick={() => scrollTo(sectionPathRef)}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Где энергия ищет выход: Число Пути</span>
              <ChevronDown size={14} />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* SECTION 5: ТРЕТИЙ КЛЮЧ (РЕАЛИЗАЦИЯ И ВЕКТОР — ПУТЬ & НАПРАВЛЕНИЕ) */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionPathRef}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block">
              Ключи III и IV · Реализация и Вектор
            </span>

            <div className="my-2">
              <Orb number={pathNum} size={190} glow={true} />
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">
                <span>{pathPalette.name}</span>
                <span>·</span>
                <span className="text-[var(--color-antique-gold)]">{pathPalette.sanskrit}</span>
                <span>·</span>
                <span>Состав: {result.pathComposite}</span>
              </div>

              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Число Пути: {pathNum}
              </h2>

              <p className="font-serif italic text-xl sm:text-2xl text-[#D8D2C4] leading-relaxed font-light pt-2">
                «{pathInfo.positions.path.essence}»
              </p>
            </div>

            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-antique-gold)] block mb-2">
                  Траектория реализации (Путь {pathNum})
                </span>
                <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                  {pathInfo.positions.path.strength}
                </p>
              </div>

              <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-purple-300 block mb-2">
                  Вектор применения (Направление {dirNum})
                </span>
                <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                  {dirInfo.positions.direction.essence}
                </p>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionTensionRef)}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Место напряжения и Тень</span>
              <ChevronDown size={14} />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* SECTION 6: ПРОТИВОРЕЧИЕ (ТЕНЬ И ВНУТРЕННЯЯ ЛОВУШКА) */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionTensionRef}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-10"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-amber-400/90 block">
              Тень и Зона Внимания
            </span>

            <div className="max-w-2xl mx-auto space-y-4">
              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Точка слива ресурса
              </h2>

              <p className="text-[16px] text-[var(--color-text-secondary)] font-light leading-relaxed pt-2">
                Тень — это не недостаток, а избыток неприрученной силы. Знание своей ловушки позволяет вовремя вернуть управление.
              </p>
            </div>

            <div className="w-full max-w-3xl p-8 sm:p-10 rounded-xs bg-[var(--color-bg-surface)] border border-amber-500/20 text-left space-y-6">
              <div>
                <span className="text-[10px] uppercase font-mono text-amber-400 tracking-wider block mb-1">
                  Ловушка архетипа {soulInfo.archetypeName} ({soulNum})
                </span>
                <p className="font-serif text-xl sm:text-2xl text-[var(--color-text-primary)] font-light">
                  {soulInfo.shadow}
                </p>
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed border-t border-white/[0.06] pt-4">
                {soulInfo.positions.soul.tension}
              </p>

              <div className="border-t border-white/[0.06] pt-4 flex items-center gap-3">
                <span className="text-[10px] uppercase font-mono text-[var(--color-antique-gold)] tracking-wider">
                  Ключ к равновесию:
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] font-light">
                  {soulInfo.practicalKey}
                </span>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionFullMapRef)}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Показать карту целиком и триптих практик</span>
              <ChevronDown size={14} />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* SECTION 7: ПОЛНАЯ КАРТА + ТРИПТИХ ПРАКТИК */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionFullMapRef}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block">
                Синтез структуры
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Полная карта кода ({day}.{month}.{year})
              </h2>
            </div>

            {/* 5 KEYS ROW */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { key: 'Душа', num: soulNum, comp: result.soulComposite, title: 'Ядро' },
                { key: 'Выражение', num: exprNum, comp: result.expressionComposite, title: 'Форма' },
                { key: 'Путь', num: pathNum, comp: result.pathComposite, title: 'Маршрут' },
                { key: 'Направление', num: dirNum, comp: result.directionComposite, title: 'Вектор' },
                { key: 'Результат', num: resNum, comp: result.resultComposite, title: 'Итог' }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="p-6 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xs flex flex-col items-center text-center"
                >
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)] mb-3">
                    {item.key}
                  </span>
                  <Orb number={item.num} size={46} glow={false} className="mb-3" />
                  <span className="font-serif text-2xl text-[var(--color-text-primary)] font-light">
                    {item.num}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">
                    {item.comp !== item.num.toString() ? item.comp : item.title}
                  </span>
                </div>
              ))}
            </div>

            {/* 3x3 MATRIX */}
            <div className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] p-8 sm:p-12 rounded-xs text-center">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-2">
                Матрица качеств
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light mb-8">
                Распределение плотности энергии
              </h3>

              <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-md mx-auto mb-8">
                {[
                  { digit: '1', name: 'Характер, воля' },
                  { digit: '4', name: 'Здоровье, тело' },
                  { digit: '7', name: 'Интуиция, удача' },
                  { digit: '2', name: 'Энергия, связь' },
                  { digit: '5', name: 'Логика, форма' },
                  { digit: '8', name: 'Долг, система' },
                  { digit: '3', name: 'Интерес, ум' },
                  { digit: '6', name: 'Мастерство' },
                  { digit: '9', name: 'Память, цель' }
                ].map((cell) => {
                  const count = result.detailedMatrix[cell.digit] || 0;
                  return (
                    <div 
                      key={cell.digit}
                      className={`p-4 rounded-xs border text-center flex flex-col justify-between min-h-[95px] transition-colors ${
                        count > 0 
                          ? 'bg-[var(--color-bg-deep)] border-[var(--color-border-gold)]' 
                          : 'bg-[var(--color-bg-deep)]/40 border-white/[0.03] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)] block">
                        {cell.digit} · {cell.name.split(',')[0]}
                      </span>
                      <span className={`font-serif text-2xl font-light ${count > 0 ? 'text-[var(--color-antique-gold)]' : 'text-stone-600'}`}>
                        {count > 0 ? cell.digit.repeat(count) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] font-light max-w-md mx-auto leading-relaxed">
                Матрица отражает распределение ресурсных качеств, плотности энергии и зон внимания в структуре личности.
              </p>
            </div>

            {/* TRIPTYCH OF PRACTICES (CLEAN EDITORIAL) */}
            <div className="w-full space-y-6 text-left">
              <div className="text-center">
                <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-2">
                  Интеграция в жизнь
                </span>
                <h3 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light">
                  Триптих практик архетипа {soulInfo.archetypeName}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Observation */}
                <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-4">
                  <span className="text-[10px] uppercase font-mono text-emerald-400 tracking-wider block">
                    01 · Наблюдение
                  </span>
                  <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                    {soulPractice.observation.insight}
                  </p>
                  <span className="text-[11px] text-[var(--color-text-muted)] font-mono block pt-2 border-t border-white/[0.04]">
                    Маркер: {soulPractice.observation.bodyMarker}
                  </span>
                </div>

                {/* 2. Action */}
                <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-4">
                  <span className="text-[10px] uppercase font-mono text-[var(--color-antique-gold)] tracking-wider block">
                    02 · Действие
                  </span>
                  <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                    {soulPractice.action.microStep}
                  </p>
                  <span className="text-[11px] text-[var(--color-text-muted)] font-mono block pt-2 border-t border-white/[0.04]">
                    Ритуал: {soulPractice.action.ritual}
                  </span>
                </div>

                {/* 3. Integration */}
                <div className="p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-4">
                  <span className="text-[10px] uppercase font-mono text-purple-300 tracking-wider block">
                    03 · Интеграция
                  </span>
                  <p className="font-serif italic text-base text-[var(--color-text-primary)] leading-relaxed">
                    «{soulPractice.integration.focusMantra}»
                  </p>
                  <span className="text-[11px] text-[var(--color-text-muted)] font-mono block pt-2 border-t border-white/[0.04]">
                    Ключ: {soulPractice.integration.balanceKey}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionAlbertRef)}
              className="px-8 py-3.5 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Осмысление и диалог с Альбертом</span>
              <ChevronDown size={14} />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* SECTION 8: МОСТ К АЛЬБЕРТУ & СИНТЕЗУ */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionAlbertRef}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-10 p-8 sm:p-14 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-gold)] shadow-[0_0_40px_rgba(200,164,93,0.06)]"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block">
              Осмысление · Проводник системы
            </span>

            <div className="max-w-2xl mx-auto space-y-3">
              <h3 className="font-serif text-3xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Диалог с Альбертом Вяземским
              </h3>
              <p className="text-[16px] text-[var(--color-text-secondary)] font-light leading-relaxed">
                Вы можете сохранить контекст вашего разбора и продолжить глубокое обсуждение чисел в Telegram или прямо здесь.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="https://t.me/digitalcodesystem_bot" 
                target="_blank" 
                rel="noreferrer"
                className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Send size={14} />
                <span>Открыть в Telegram</span>
              </a>

              <button
                onClick={() => setIsAlbertOpen(true)}
                className="px-8 py-3.5 border border-white/15 text-[var(--color-text-primary)] hover:text-white uppercase tracking-[0.2em] text-xs rounded-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare size={14} />
                <span>Диалог на сайте</span>
              </button>
            </div>

            {/* Synthesis / Meeting CTA */}
            <div className="w-full pt-10 border-t border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-left">
                <span className="text-[10px] uppercase font-mono text-[var(--color-antique-gold)] block mb-1">
                  Следующий шаг исследования
                </span>
                <span className="text-sm text-[var(--color-text-secondary)] font-light">
                  {hasMythResult 
                    ? 'Ваш Личный Миф уже создан. Готовы сопоставить оба зеркала?' 
                    : 'Пройдите образный ритуал Личного Мифа для встречи двух зеркал.'}
                </span>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {onNavigateToMeeting && (
                  <button 
                    onClick={onNavigateToMeeting}
                    className="px-6 py-3 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <GitFork size={14} />
                    <span>{hasMythResult ? 'Встреча Зеркал →' : 'Личный Миф →'}</span>
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="p-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                  title="Рассчитать другую дату"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* Albert Web Dialogue Modal */}
      <AlbertDialogue
        isOpen={isAlbertOpen}
        onClose={() => setIsAlbertOpen(false)}
        calc={result}
        initialTopic={result ? `Разбор даты ${day}.${month}.${year} (Душа ${soulNum}, Путь ${pathNum}, Выражение ${exprNum})` : ''}
        theme="dark"
      />

    </div>
  );
}
