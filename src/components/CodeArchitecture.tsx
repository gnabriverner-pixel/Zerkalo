import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
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
import { getCompoundKnowledge } from '../data/compoundKnowledge';
import { 
  COSMOLOGY_IMMERSION_CHAPTERS, 
  getBirthDayProfile, 
  getGrahaCosmology, 
  getPersonalYearMeaning 
} from '../data/vedicCosmology';
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
  const [activeCosmologyChapter, setActiveCosmologyChapter] = useState<number>(0);
  const [selectedStarIndex, setSelectedStarIndex] = useState<number>(0);

  // Smooth navigation anchors
  const sectionIntroRef = useRef<HTMLDivElement>(null);
  const sectionCosmologyRef = useRef<HTMLDivElement>(null);
  const sectionSoulRef = useRef<HTMLDivElement>(null);
  const sectionExpressionRef = useRef<HTMLDivElement>(null);
  const sectionPathRef = useRef<HTMLDivElement>(null);
  const sectionAlbertSynthesisRef = useRef<HTMLDivElement>(null);
  const sectionFullMapRef = useRef<HTMLDivElement>(null);
  const sectionCycleRef = useRef<HTMLDivElement>(null);
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
    const fallbackMirror = generateFirstMirror(calc);
    setResult(calc);
    setReading(fallbackMirror);
    setSelectedStarIndex(0);
    setIsGenerating(true);

    let finalReading = fallbackMirror;
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'code', date: fullDate, calc })
      });
      const data: ApiResponse = await res.json();
      if (data.status === 'ok' && data.code_result?.first_mirror) {
        finalReading = data.code_result.first_mirror;
        setReading(finalReading);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
      if (onCodeCalculated) {
        onCodeCalculated(calc, finalReading);
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
  const birthDayNum = result ? (result.birthDayNumber || parseInt(day, 10) || 1) : 1;
  const personalYearNum = result ? (result.personalYear || 1) : 1;

  const soulInfo = numberKnowledge[soulNum] || numberKnowledge[1];
  const exprInfo = numberKnowledge[exprNum] || numberKnowledge[1];
  const pathInfo = numberKnowledge[pathNum] || numberKnowledge[1];
  const dirInfo = numberKnowledge[dirNum] || numberKnowledge[1];
  const resInfo = numberKnowledge[resNum] || numberKnowledge[1];

  const exprPalette = PLANET_PALETTES[exprNum] || PLANET_PALETTES[1];
  const pathPalette = PLANET_PALETTES[pathNum] || PLANET_PALETTES[1];

  const soulPractice = PASSPORT_PRACTICES[soulNum] || PASSPORT_PRACTICES[1];

  // Vedic Cosmology & Individual Nuance Data
  const birthDayProfile = getBirthDayProfile(birthDayNum);
  const soulCosmology = getGrahaCosmology(soulNum);
  const exprCosmology = getGrahaCosmology(exprNum);
  const pathCosmology = getGrahaCosmology(pathNum);
  const dirCosmology = getGrahaCosmology(dirNum);
  const resCosmology = getGrahaCosmology(resNum);
  const personalYearMeaning = getPersonalYearMeaning(personalYearNum);

  const exprCompound = result?.expressionComposite ? getCompoundKnowledge(result.expressionComposite) : null;
  const pathCompound = result?.pathComposite ? getCompoundKnowledge(result.pathComposite) : null;
  const dirCompound = result?.directionComposite ? getCompoundKnowledge(result.directionComposite) : null;
  const resCompound = result?.resultComposite ? getCompoundKnowledge(result.resultComposite) : null;

  // Interactive 5-Star Constellation Data
  const constellationStars = result
    ? [
        {
          id: 'soul',
          role: 'Первая Звезда · Внутреннее Солнце (Душа)',
          number: soulNum,
          composite: result.soulComposite,
          archetype: soulInfo.archetypeName,
          planet: soulCosmology.sanskritName,
          element: soulCosmology.element,
          essence: soulInfo.positions.soul.essence,
          wingPower: birthDayProfile.keyAdvice,
          x: 200,
          y: 44,
        },
        {
          id: 'expression',
          role: 'Вторая Звезда · Внешний Жест (Выражение)',
          number: exprNum,
          composite: result.expressionComposite,
          archetype: exprInfo.archetypeName,
          planet: exprCosmology.sanskritName,
          element: exprCosmology.element,
          essence: exprInfo.positions.expression.essence,
          wingPower: exprInfo.positions.expression.strength,
          x: 344,
          y: 128,
        },
        {
          id: 'path',
          role: 'Третья Звезда · Большая Орбита (Путь)',
          number: pathNum,
          composite: result.pathComposite,
          archetype: pathInfo.archetypeName,
          planet: pathCosmology.sanskritName,
          element: pathCosmology.element,
          essence: pathInfo.positions.path.essence,
          wingPower: pathInfo.positions.path.strength,
          x: 292,
          y: 274,
        },
        {
          id: 'direction',
          role: 'Четвёртая Звезда · Крылья Мечты (Направление)',
          number: dirNum,
          composite: result.directionComposite,
          archetype: dirInfo.archetypeName,
          planet: dirCosmology.sanskritName,
          element: dirCosmology.element,
          essence: dirInfo.positions.direction.essence,
          wingPower: dirInfo.positions.direction.recommendation,
          x: 108,
          y: 274,
        },
        {
          id: 'result',
          role: 'Пятая Звезда · Зрелое Сокровище (Результат)',
          number: resNum,
          composite: result.resultComposite,
          archetype: resInfo.archetypeName,
          planet: resCosmology.sanskritName,
          element: resCosmology.element,
          essence: resInfo.positions.result.essence,
          wingPower: resInfo.positions.result.strength,
          x: 56,
          y: 128,
        },
      ]
    : [];

  const activeStar = constellationStars[selectedStarIndex] || constellationStars[0];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-20 sm:py-28 px-6 sm:px-10 text-[var(--color-text-primary)] font-sans relative overflow-x-hidden w-full">
      
      {/* ========================================================= */}
      {/* 1. INITIAL BREATHING PORTAL (When no result yet)          */}
      {/* ========================================================= */}
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-center w-full max-w-3xl mx-auto py-8 my-auto space-y-28"
        >
          <div className="space-y-10">
            <div className="flex justify-center mb-4 animate-float-gentle">
              <Orb number={1} size={185} glow={true} />
            </div>

            <div className="space-y-5">
              <span className="text-[11px] uppercase tracking-[0.42em] text-[var(--color-antique-gold)] font-mono block opacity-85">
                Орбита II · Ведическая Космология и Природа Человека
              </span>

              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-[var(--color-text-primary)] font-light tracking-tight leading-[1.06]">
                Открой созвездие <span className="italic text-[var(--color-antique-gold)]">своей свободы</span>
              </h1>

              <p className="font-serif text-xl sm:text-2xl text-[var(--color-text-secondary)] leading-[1.8] max-w-xl mx-auto font-light pt-2">
                Введи дату своего появления на свет. Перед тобой развернётся единая музыка твоих пяти ключей, неповторимый оттенок дня рождения и горизонт твоей мечты.
              </p>
            </div>

            {/* THREE WEIGHTLESS DATE FIELDS: [ ДД ] · [ ММ ] · [ ГГГГ ] */}
            <form onSubmit={handleCalculate} className="w-full flex flex-col items-center space-y-10 pt-4">
              
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <input
                  ref={dayRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ДД"
                  maxLength={2}
                  value={day}
                  onChange={handleDayChange}
                  onKeyDown={(e) => handleKeyDown(e, 'day')}
                  className="w-16 sm:w-24 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 outline-none py-2 transition-colors tabular-nums"
                />
                <span className="text-[var(--color-antique-gold)]/60 font-serif text-3xl">·</span>
                <input
                  ref={monthRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ММ"
                  maxLength={2}
                  value={month}
                  onChange={handleMonthChange}
                  onKeyDown={(e) => handleKeyDown(e, 'month')}
                  className="w-16 sm:w-24 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 outline-none py-2 transition-colors tabular-nums"
                />
                <span className="text-[var(--color-antique-gold)]/60 font-serif text-3xl">·</span>
                <input
                  ref={yearRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ГГГГ"
                  maxLength={4}
                  value={year}
                  onChange={handleYearChange}
                  onKeyDown={(e) => handleKeyDown(e, 'year')}
                  className="w-28 sm:w-36 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 outline-none py-2 transition-colors tabular-nums"
                />
              </div>

              {dateError && (
                <p className="text-xs text-amber-300 font-light">{dateError}</p>
              )}

              <button
                type="submit"
                disabled={isGenerating || day.length !== 2 || month.length !== 2 || year.length !== 4}
                className="px-10 py-4 border border-[var(--color-antique-gold)]/45 bg-[var(--color-antique-gold)]/[0.08] hover:bg-[var(--color-antique-gold)]/[0.18] text-[var(--color-antique-gold)] rounded-full uppercase tracking-[0.28em] text-[11px] font-mono disabled:opacity-25 transition-all flex items-center gap-3 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Зажигаем ваше созвездие...</span>
                  </>
                ) : (
                  <span>Раскрыть звёздный атлас →</span>
                )}
              </button>

              {/* Quiet Consent & About */}
              <div className="pt-2 flex items-center justify-center gap-6 text-[11px] text-[var(--color-text-muted)] font-light">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="accent-[var(--color-antique-gold)]"
                  />
                  <span>Пространство свободного самопознания</span>
                </label>
                {onOpenAbout && (
                  <button
                    type="button"
                    onClick={onOpenAbout}
                    className="text-[var(--color-antique-gold)] hover:underline cursor-pointer"
                  >
                    О традиции Санкхья
                  </button>
                )}
              </div>

            </form>
          </div>

          {/* BREATHING PROLOGUE ON VEDIC COSMOLOGY */}
          <div className="w-full pt-20 border-t border-white/[0.08] text-left space-y-12">
            <div className="text-center max-w-xl mx-auto space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[#7CE8EE] block">
                Мудрость тысячелетий · Без нотаций и догм
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light">
                Гармония Космоса и Человека
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-16">
              {COSMOLOGY_IMMERSION_CHAPTERS.slice(0, 2).map((ch) => (
                <div key={ch.id} className="space-y-4">
                  <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-[var(--color-antique-gold)] block">
                    {ch.tag}
                  </span>
                  <h3 className="font-serif text-2xl text-[var(--color-text-primary)] font-light">
                    {ch.title}
                  </h3>
                  <p className="font-serif italic text-lg text-[#EAE4D7] leading-[1.8] font-light">
                    «{ch.simpleAnalogy}»
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] font-light leading-[1.9]">
                    {ch.deepText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* 2. BREATHING COSMIC SYMPHONY (When result is calculated)  */}
      {/* ========================================================= */}
      {result && (
        <div className="w-full max-w-4xl flex flex-col items-center relative z-10 space-y-36 sm:space-y-48 pb-32">
          
          {/* ------------------------------------------------------- */}
          {/* OVERTURE: DATE & OPEN CONSTELLATION IN THE SKY          */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionIntroRef}
            className="w-full flex flex-col items-center justify-center text-center pt-4 space-y-16"
          >
            <div className="space-y-6 max-w-3xl mx-auto">
              <span className="text-[11px] uppercase tracking-[0.42em] text-[var(--color-antique-gold)] font-mono block opacity-85">
                Звёздный Атлас Свободы · Гармония Пяти Ключей
              </span>

              <h1 className="font-serif text-6xl sm:text-7xl lg:text-[92px] text-[var(--color-antique-gold)] font-light tracking-tight leading-none tabular-nums">
                {`${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`}
              </h1>

              <p className="font-serif italic text-2xl sm:text-3xl text-[#F7F4ED] max-w-2xl mx-auto leading-[1.7] font-light pt-4">
                «{reading?.keyInsight || 'В вашей дате рождения звучит редкая космическая мелодия — она создана, чтобы напомнить, какого масштаба мечту вы способны воплотить.'}»
              </p>
            </div>

            {/* FLOATING 5-STAR CONSTELLATION (NO HEAVY BOX AROUND IT) */}
            <div className="w-full flex flex-col items-center space-y-12 pt-4">
              
              <div className="relative w-full max-w-[380px] aspect-[400/330] flex items-center justify-center">
                <svg viewBox="0 0 400 330" className="w-full h-full overflow-visible">
                  {/* Delicate Celestial Orbits */}
                  <circle
                    cx="200"
                    cy="170"
                    r="130"
                    fill="none"
                    stroke="rgba(223, 190, 120, 0.16)"
                    strokeWidth="0.8"
                    strokeDasharray="2 7"
                  />
                  <circle
                    cx="200"
                    cy="170"
                    r="76"
                    fill="none"
                    stroke="rgba(124, 232, 238, 0.12)"
                    strokeWidth="0.7"
                  />

                  {/* Star-Lines Connecting the 5 Keys */}
                  <polygon
                    points={constellationStars.map((s) => `${s.x},${s.y}`).join(' ')}
                    fill="rgba(223, 190, 120, 0.025)"
                    stroke="rgba(223, 190, 120, 0.32)"
                    strokeWidth="1"
                  />
                  <line
                    x1={constellationStars[0].x}
                    y1={constellationStars[0].y}
                    x2={constellationStars[2].x}
                    y2={constellationStars[2].y}
                    stroke="rgba(124, 232, 238, 0.22)"
                    strokeWidth="0.8"
                    strokeDasharray="3 5"
                  />
                  <line
                    x1={constellationStars[1].x}
                    y1={constellationStars[1].y}
                    x2={constellationStars[3].x}
                    y2={constellationStars[3].y}
                    stroke="rgba(124, 232, 238, 0.22)"
                    strokeWidth="0.8"
                    strokeDasharray="3 5"
                  />

                  {/* Interactive Star Nodes */}
                  {constellationStars.map((star, idx) => {
                    const p = PLANET_PALETTES[star.number] || PLANET_PALETTES[1];
                    const isSelected = selectedStarIndex === idx;
                    return (
                      <g
                        key={star.id}
                        onClick={() => setSelectedStarIndex(idx)}
                        className="cursor-pointer"
                      >
                        {isSelected && (
                          <circle
                            cx={star.x}
                            cy={star.y}
                            r="34"
                            fill={p.glow}
                            opacity="0.55"
                          />
                        )}
                        <circle
                          cx={star.x}
                          cy={star.y}
                          r={isSelected ? '23' : '18'}
                          fill="#050914"
                          stroke={p.color}
                          strokeWidth={isSelected ? '2' : '1.2'}
                        />
                        <text
                          x={star.x}
                          y={star.y + 6}
                          textAnchor="middle"
                          fill={p.accent}
                          className="font-serif text-lg select-none"
                        >
                          {star.number}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Airy Underline Navigation for the 5 Keys */}
              <div className="flex flex-wrap justify-center gap-6 sm:gap-10 border-b border-white/[0.08] pb-4 w-full max-w-2xl">
                {['Душа', 'Выражение', 'Путь', 'Направление', 'Результат'].map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedStarIndex(idx)}
                    className={`pb-2 text-xs font-mono uppercase tracking-[0.22em] transition-all cursor-pointer border-b -mb-[17px] ${
                      selectedStarIndex === idx
                        ? 'border-[var(--color-antique-gold)] text-[var(--color-antique-gold)]'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
                    }`}
                  >
                    {label} · {constellationStars[idx]?.composite}
                  </button>
                ))}
              </div>

              {/* Harmonious Reading of the Selected Star */}
              {activeStar && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStar.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="max-w-2xl mx-auto text-center space-y-5 pt-2"
                  >
                    <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[#7CE8EE] block">
                      {activeStar.role} · {activeStar.planet} · {activeStar.element}
                    </span>

                    <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                      {activeStar.archetype} ({activeStar.composite})
                    </h2>

                    <p className="font-serif italic text-xl sm:text-2xl text-[#EAE4D7] leading-[1.8] font-light">
                      «{activeStar.essence}»
                    </p>

                    <p className="text-base text-[var(--color-text-secondary)] font-light leading-[1.9]">
                      {activeStar.wingPower}
                    </p>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            <div className="pt-8">
              <button
                onClick={() => scrollTo(sectionSoulRef)}
                className="text-[11px] font-mono uppercase tracking-[0.3em] text-[var(--color-antique-gold)] hover:text-white transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Начать плавное погружение в симфонию чисел</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </section>

          {/* ------------------------------------------------------- */}
          {/* BREATH I: ВНУТРЕННЕЕ СОЛНЦЕ И МЕЛОДИЯ ДНЯ РОЖДЕНИЯ      */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionSoulRef}
            className="w-full scroll-mt-24 pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-6 max-w-3xl mx-auto">
              <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[var(--color-antique-gold)] block">
                Дыхание Первое · Ключ I · Число Души и День Рождения
              </span>

              <div className="py-4 flex justify-center animate-float-gentle">
                <Orb number={soulNum} size={220} glow={true} />
              </div>

              <span className="text-xs font-mono text-[#7CE8EE] uppercase tracking-[0.28em] block">
                {soulCosmology.sanskritName} · {soulCosmology.element} · День {birthDayNum} ({birthDayProfile.formula})
              </span>

              <h2 className="font-serif text-4xl sm:text-6xl text-[var(--color-text-primary)] font-light leading-tight">
                {birthDayProfile.title}
              </h2>

              <p className="font-serif italic text-2xl sm:text-3xl text-[#EAE4D7] leading-[1.75] font-light pt-2">
                «{soulInfo.positions.soul.essence}»
              </p>
            </div>

            {/* HARMONIOUS CONTINUOUS NARRATIVE (Instead of 8 fragmented boxes) */}
            <div className="w-full max-w-2xl mx-auto text-left space-y-10 font-serif text-xl sm:text-[23px] text-[var(--color-text-primary)] leading-[1.9] font-light">
              <p>
                В ведической космологии ваше внутреннее ядро звучит на частоте светила <strong className="font-normal text-[var(--color-antique-gold)]">{soulCosmology.sanskritName}</strong> ({soulCosmology.element.toLowerCase()}). Если объяснить эту природу совсем просто и прозрачно: {soulCosmology.childExplanation.charAt(0).toLowerCase() + soulCosmology.childExplanation.slice(1)}
              </p>

              <p className="text-[var(--color-text-secondary)]">
                Но у вашего числа Души ({soulNum}) есть неповторимый индивидуальный оттенок, рождённый именно <strong className="font-normal text-white">{birthDayNum}-м числом месяца</strong> ({birthDayProfile.planetaryBlend.toLowerCase()}). {birthDayProfile.whyUnique} {birthDayProfile.innerNature}
              </p>

              <p className="text-[var(--color-text-secondary)]">
                Ваш естественный дар проявляется тогда, когда вы доверяете себе: {birthDayProfile.giftInAction.charAt(0).toLowerCase() + birthDayProfile.giftInAction.slice(1)} А то, что иногда ощущается как внутреннее сжатие или усталость, — вовсе не ошибка характера: {birthDayProfile.hiddenTrap.charAt(0).toLowerCase() + birthDayProfile.hiddenTrap.slice(1)}
              </p>
            </div>

            {/* Luminous Callout: Scale of the Dream */}
            <div className="w-full max-w-2xl mx-auto pt-8 border-t border-white/[0.08] text-center space-y-4">
              <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[var(--color-antique-gold)] block">
                Масштаб вашей мечты · На что вы способны
              </span>
              <p className="font-serif italic text-2xl sm:text-3xl text-[#F7F4ED] font-light leading-[1.75]">
                «{birthDayProfile.keyAdvice}»
              </p>
              <p className="text-sm text-[#7CE8EE] font-light pt-2">
                Вопрос для полёта: {soulCosmology.lifeQuestion}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------- */}
          {/* BREATH II: ВНЕШНИЙ ЖЕСТ И ТАНЕЦ ДВУХ СВЕТИЛ             */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionExpressionRef}
            className="w-full scroll-mt-24 pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-6 max-w-3xl mx-auto">
              <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[#7CE8EE] block">
                Дыхание Второе · Ключ II · Внешний Свет и Созвучие с Душой
              </span>

              {/* Two Orbs Dancing in Open Space */}
              <div className="flex items-center justify-center gap-10 sm:gap-20 py-6">
                <div className="flex flex-col items-center gap-3">
                  <Orb number={soulNum} size={130} glow={true} />
                  <span className="text-[11px] font-mono text-[var(--color-antique-gold)] uppercase tracking-[0.25em]">
                    Душа {soulNum}
                  </span>
                </div>

                <span className="font-serif text-3xl text-white/30 font-light">~</span>

                <div className="flex flex-col items-center gap-3">
                  <Orb number={exprNum} size={130} glow={true} />
                  <span className="text-[11px] font-mono text-[#7CE8EE] uppercase tracking-[0.25em]">
                    Выражение {result.expressionComposite}
                  </span>
                </div>
              </div>

              <h2 className="font-serif text-4xl sm:text-6xl text-[var(--color-text-primary)] font-light leading-tight">
                {exprInfo.archetypeName} ({exprNum}) · Танец Внутреннего и Внешнего
              </h2>

              <p className="font-serif italic text-2xl sm:text-3xl text-[#EAE4D7] leading-[1.75] font-light pt-2">
                «{exprInfo.positions.expression.essence}»
              </p>
            </div>

            {/* Unified Literary Narrative of Expression + Soul Coupling */}
            <div className="w-full max-w-2xl mx-auto text-left space-y-10 font-serif text-xl sm:text-[23px] text-[var(--color-text-primary)] leading-[1.9] font-light">
              <p>
                Когда вы входите в пространство, начинаете говорить или созидать, включается ваш второй ключ — <strong className="font-normal text-[#7CE8EE]">Число Выражения {result.expressionComposite}</strong> ({exprPalette.name}, {exprCosmology.element.toLowerCase()}). {exprInfo.positions.expression.strength}
              </p>

              {exprCompound && (
                <p className="text-[var(--color-text-secondary)]">
                  Особую глубину вашему почерку придаёт составное число <strong className="font-normal text-white">{result.expressionComposite}</strong> ({exprCompound.formula}): {exprCompound.short.toLowerCase()}. {exprCompound.accent}
                </p>
              )}

              <p className="text-[var(--color-text-secondary)]">
                {soulNum === exprNum
                  ? 'Удивительная редкость вашей карты в том, что ваше число Души и число Выражения совпадают. Ваша внутренняя мечта без малейшего преломления переходит во внешний жест — вы звучите цельно, прозрачно и притягиваете людей своей подлинностью.'
                  : `Посмотрите, как гармонично устроен ваш дуэт стихий: внутри сердца поёт «${soulInfo.archetypeName}» (${soulCosmology.element.toLowerCase()}), а во внешнем мире его бережно обрамляет и проводит «${exprInfo.archetypeName}» (${exprCosmology.element.toLowerCase()}). Вам не нужно выбирать между ними — ваше внешнее число служит крыльями и языком дипломатии для вашей внутренней глубины.`}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------- */}
          {/* BREATH III: БОЛЬШАЯ ОРБИТА, КРЫЛЬЯ И СОКРОВИЩЕ (III–V)  */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionPathRef}
            className="w-full scroll-mt-24 pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-6 max-w-3xl mx-auto">
              <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[var(--color-antique-gold)] block">
                Дыхание Третье · Ключи III, IV и V · Большая Орбита Жизни
              </span>

              <div className="py-4 flex justify-center animate-float-gentle">
                <Orb number={pathNum} size={200} glow={true} />
              </div>

              <span className="text-xs font-mono text-[#7CE8EE] uppercase tracking-[0.28em] block">
                {pathPalette.name} · {pathCosmology.element} · Код маршрута {result.pathComposite}
              </span>

              <h2 className="font-serif text-4xl sm:text-6xl text-[var(--color-text-primary)] font-light leading-tight">
                Орбита Пути: {pathInfo.archetypeName} ({pathNum})
              </h2>

              <p className="font-serif italic text-2xl sm:text-3xl text-[#EAE4D7] leading-[1.75] font-light pt-2">
                «{pathInfo.positions.path.essence}»
              </p>
            </div>

            {/* Unified Literary Narrative of Path, Direction, and Result */}
            <div className="w-full max-w-2xl mx-auto text-left space-y-10 font-serif text-xl sm:text-[23px] text-[var(--color-text-primary)] leading-[1.9] font-light">
              {pathCompound && (
                <p>
                  Сумма всех цифр вашей даты рождения складывается в составной код <strong className="font-normal text-[var(--color-antique-gold)]">{result.pathComposite}</strong> ({pathCompound.formula}) — «{pathCompound.short}». {pathCompound.accent} {pathCompound.recommendation}
                </p>
              )}

              <p className="text-[var(--color-text-secondary)]">
                На этой большой орбите вашим ускорителем и точкой приложения мечты выступает четвёртый ключ — <strong className="font-normal text-[#7CE8EE]">Число Направления {result.directionComposite}</strong> ({dirInfo.positions.direction.title.toLowerCase()}). {dirInfo.positions.direction.essence} {dirCompound ? dirCompound.accent : ''}
              </p>

              <p className="text-[var(--color-text-secondary)]">
                И когда ваше сердце (Душа {soulNum}), ваш почерк (Выражение {exprNum}), ваша дорога (Путь {pathNum}) и вектор (Направление {dirNum}) звучат в согласии, раскрывается пятая вершина вашего созвездия — <strong className="font-normal text-[var(--color-antique-gold)]">Число Результата {result.resultComposite}</strong> ({resInfo.positions.result.title.toLowerCase()}). {resInfo.positions.result.essence} {resCompound ? resCompound.accent : ''}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------- */}
          {/* BREATH IV: ГОЛОС АЛЬБЕРТА ВЯЗЕМСКОГО (СИНТЕЗ СМЫСЛОВ)   */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAlbertSynthesisRef}
            className="w-full scroll-mt-24 pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-4 max-w-2xl mx-auto">
              <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[var(--color-antique-gold)] block">
                Дыхание Четвёртое · Живой Синтез Альберта Вяземского
              </span>
              <h2 className="font-serif text-4xl sm:text-6xl text-[var(--color-text-primary)] font-light">
                {reading?.title || 'Созвездие вашей свободы'}
              </h2>
              <p className="text-xs font-mono text-[#7CE8EE] uppercase tracking-[0.28em]">
                {reading?.formula?.numbers || `${soulNum} · ${pathNum} · ${exprNum} · ${dirNum} · ${resNum}`} — {reading?.formula?.planets}
              </p>
            </div>

            {isGenerating && (
              <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-antique-gold)] py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Альберт сплетает единую симфонию вашей пятёрки чисел...</span>
              </div>
            )}

            {/* Flowing Literary Chapters instead of Separate Boxes */}
            {reading && (
              <div className="w-full max-w-2xl mx-auto text-left space-y-16">
                {reading.blocks.map((block, idx) => (
                  <div
                    key={block.id || idx}
                    className={`space-y-4 ${
                      block.id === 'resonance'
                        ? 'pt-12 border-t border-[var(--color-border-gold)] text-center'
                        : ''
                    }`}
                  >
                    <span className="text-[10px] uppercase font-mono tracking-[0.32em] text-[var(--color-antique-gold)] block">
                      0{idx + 1} · {block.title}
                    </span>
                    <p
                      className={
                        block.id === 'resonance'
                          ? 'font-serif italic text-2xl sm:text-3xl text-[#F7F4ED] leading-[1.85] font-light'
                          : 'font-serif text-xl sm:text-[23px] text-[var(--color-text-primary)] leading-[1.9] font-light'
                      }
                    >
                      {block.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ------------------------------------------------------- */}
          {/* BREATH V: ПРОСТРАНСТВО СВОБОДЫ (МАТРИЦА 3x3 И ШУНЬЯ)    */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionFullMapRef}
            className="w-full scroll-mt-24 pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-4 max-w-2xl mx-auto">
              <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[#7CE8EE] block">
                Дыхание Пятое · Звёздная Решётка Талантов и Открытое Небо
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Матрица Канона и Пространство Свободы
              </h2>
              {result.matrixAnalysis?.workingNumbers && (
                <p className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-[0.25em] tabular-nums">
                  Ступени расчёта: I ({result.matrixAnalysis.workingNumbers.rc1}) · II ({result.matrixAnalysis.workingNumbers.rc2}) · III ({result.matrixAnalysis.workingNumbers.rc3}) · IV ({result.matrixAnalysis.workingNumbers.rc4})
                </p>
              )}
            </div>

            {/* Weightless Hairline 3x3 Grid */}
            <div className="grid grid-cols-3 gap-px bg-white/[0.08] border border-white/[0.08] max-w-lg w-full mx-auto">
              {[
                { digit: '1', name: 'Солнечная воля' },
                { digit: '4', name: 'Кристалл формы' },
                { digit: '7', name: 'Звёздный поток' },
                { digit: '2', name: 'Живое тепло' },
                { digit: '5', name: 'Крылья мысли' },
                { digit: '8', name: 'Масштаб орбиты' },
                { digit: '3', name: 'Радость знания' },
                { digit: '6', name: 'Красота и вкус' },
                { digit: '9', name: 'Высота мечты' }
              ].map((cell) => {
                const count = result.detailedMatrix[cell.digit] || 0;
                return (
                  <div 
                    key={cell.digit}
                    className="p-6 sm:p-8 bg-[#050914] text-center flex flex-col justify-between min-h-[120px]"
                  >
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider block">
                      {cell.digit} · {cell.name}
                    </span>
                    <span className={`font-serif text-3xl sm:text-4xl font-light tabular-nums pt-2 ${count > 0 ? 'text-[var(--color-antique-gold)]' : 'text-[#7CE8EE]/45 text-xl'}`}>
                      {count > 0 ? cell.digit.repeat(count) : 'Небо'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Harmonious Narrative of Matrix Peaks, Open Sky & Zeros */}
            {result.matrixAnalysis && (
              <div className="w-full max-w-2xl mx-auto text-left space-y-10 font-serif text-xl sm:text-[22px] text-[var(--color-text-secondary)] leading-[1.9] font-light">
                {result.matrixAnalysis.peaks.length > 0 && (
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase font-mono tracking-[0.32em] text-[var(--color-antique-gold)] block">
                      Ваши природные двигатели
                    </span>
                    {result.matrixAnalysis.peaks.map((peak) => (
                      <p key={peak.digit}>
                        <strong className="font-normal text-white">Созвездие {peak.digit.repeat(peak.count)} ({peak.quality.split('(')[0].trim()}):</strong> {peak.meaning}
                      </p>
                    ))}
                  </div>
                )}

                {result.matrixAnalysis.activeLines.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                    <span className="text-[10px] uppercase font-mono tracking-[0.32em] text-[#7CE8EE] block">
                      Световые мосты вашей карты
                    </span>
                    {result.matrixAnalysis.activeLines.slice(0, 3).map((line) => (
                      <p key={line.id}>
                        <strong className="font-normal text-white">{line.name}:</strong> {line.meaning}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                  <span className="text-[10px] uppercase font-mono tracking-[0.32em] text-[var(--color-antique-gold)] block">
                    Территория свободной импровизации и роль Нулей (Шунья)
                  </span>
                  <p>
                    Ячейки, отмеченные словом <strong className="font-normal text-[#7CE8EE]">«Небо»</strong>, в системе Канона означают вовсе не нехватку, а пространство чистой свободы, где вас не сковывает ни одна врождённая привычка и вы можете творить по собственному выбору.
                  </p>
                  <p>
                    <strong className="font-normal text-white">Нулей-резонаторов в вашем расчёте ({result.matrixAnalysis.zerosCount}):</strong> {result.matrixAnalysis.zerosMeaning}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ------------------------------------------------------- */}
          {/* BREATH VI: ПОПУТНЫЙ ВЕТЕР ГОДА И ТРИ КЛЮЧА ДНЯ          */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionCycleRef}
            className="w-full scroll-mt-24 pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-6 max-w-2xl mx-auto">
              <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[#7CE8EE] block">
                Дыхание Шестое · Ритмы Времени · {new Date().getFullYear()} год
              </span>

              <div className="flex justify-center py-2">
                <Orb number={personalYearNum} size={130} glow={true} />
              </div>

              <h3 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Личный Год {personalYearNum} · {personalYearMeaning.seasonTitle}
              </h3>

              <p className="font-serif italic text-xl sm:text-2xl text-[#EAE4D7] font-light leading-[1.8]">
                «{personalYearMeaning.metaphor}»
              </p>
            </div>

            <div className="w-full max-w-2xl mx-auto text-left space-y-8 font-serif text-xl sm:text-[22px] text-[var(--color-text-secondary)] leading-[1.9] font-light">
              <p className="text-[var(--color-text-primary)]">
                {personalYearMeaning.essence}
              </p>
              <p>
                <strong className="font-normal text-[var(--color-antique-gold)]">Куда дует попутный ветер:</strong> {personalYearMeaning.favorableFocus}
              </p>
              <p>
                <strong className="font-normal text-[#7CE8EE]">Источник вашей лёгкости:</strong> {personalYearMeaning.whatToAvoid}
              </p>
            </div>

            {/* Three Poetic Keys of Daily Resonance */}
            <div className="w-full max-w-3xl pt-16 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono text-[var(--color-antique-gold)] tracking-[0.28em] block">
                  I · Чувствование
                </span>
                <p className="font-serif text-lg text-[var(--color-text-primary)] font-light leading-[1.8]">
                  {soulPractice.observation.insight}
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono text-[#7CE8EE] tracking-[0.28em] block">
                  II · Импульс полёта
                </span>
                <p className="font-serif text-lg text-[var(--color-text-primary)] font-light leading-[1.8]">
                  {soulPractice.action.microStep}
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono text-[var(--color-antique-gold)] tracking-[0.28em] block">
                  III · Формула свободы
                </span>
                <p className="font-serif italic text-lg text-[#F7F4ED] font-light leading-[1.8]">
                  «{soulPractice.integration.focusMantra}»
                </p>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------- */}
          {/* BREATH VII: ОТКРЫТЫЙ ДИАЛОГ С АЛЬБЕРТОМ И ВСТРЕЧА       */}
          {/* ------------------------------------------------------- */}
          <section 
            ref={sectionAlbertRef}
            className="w-full scroll-mt-24 pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-12"
          >
            <div className="max-w-2xl mx-auto space-y-4">
              <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[var(--color-antique-gold)] block">
                Живое Продолжение
              </span>
              <h3 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Беседа с Альбертом Вяземским
              </h3>
              <p className="font-serif text-xl text-[var(--color-text-secondary)] font-light leading-[1.8]">
                Вы можете продолжить неспешный разговор о вашем созвездии чисел, вашем деле и вашей мечте прямо здесь или в Telegram.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
              <button
                onClick={() => setIsAlbertOpen(true)}
                className="px-9 py-4 border border-[var(--color-antique-gold)]/45 bg-[var(--color-antique-gold)]/[0.08] hover:bg-[var(--color-antique-gold)]/[0.18] text-[var(--color-antique-gold)] uppercase tracking-[0.25em] text-[11px] font-mono rounded-full transition-all flex items-center gap-2.5 cursor-pointer"
              >
                <MessageSquare size={14} />
                <span>Задать вопрос Альберту на сайте</span>
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

            {/* Quiet Bridge to Personal Myth / Meeting */}
            <div className="w-full max-w-2xl pt-16 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-6">
              <span className="text-sm text-[var(--color-text-secondary)] font-light">
                {hasMythResult 
                  ? 'Ваша сказка Личного Мифа уже создана. Готовы соединить оба отражения?' 
                  : 'Откройте вторую орбиту — Личный Миф, чтобы увидеть встречу двух зеркал.'}
              </span>

              <div className="flex items-center gap-6 shrink-0">
                {onNavigateToMeeting && (
                  <button 
                    onClick={onNavigateToMeeting}
                    className="pb-1 border-b border-[var(--color-antique-gold)]/50 hover:border-[var(--color-antique-gold)] text-[var(--color-antique-gold)] uppercase tracking-[0.25em] text-[11px] font-mono transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <GitFork size={13} />
                    <span>{hasMythResult ? 'Встреча Зеркал →' : 'Личный Миф →'}</span>
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="p-2 text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer"
                  title="Ввести другую дату"
                >
                  <RotateCcw size={15} />
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
        initialTopic={result ? `Звёздный атлас даты ${day}.${month}.${year} (День рождения ${birthDayNum}, Душа ${result.soulComposite}, Путь ${result.pathComposite}, Выражение ${result.expressionComposite}, Личный год ${personalYearNum})` : ''}
        theme="dark"
      />

    </div>
  );
}
