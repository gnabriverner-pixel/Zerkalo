import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  ChevronDown, 
  Loader2, 
  RotateCcw, 
  Eye,
  Zap,
  Shield
} from 'lucide-react';
import { CalculationResult, FirstMirror, ApiResponse } from '../types';
import { calculateDigitalCode } from '../services/calculator';
import { generateFirstMirror } from '../services/interpretation';
import { numberKnowledge } from '../data/numberKnowledge';
import { PASSPORT_PRACTICES } from '../data/passportPractices';
import { ArchetypeBasRelief, ARCHETYPE_VISUALS } from './ArchetypeBasRelief';
import { validateBirthDate } from '../services/birthDate';

interface AlabasterSanctuaryProps {
  initialDate?: string;
  initialResult?: CalculationResult | null;
  initialReading?: FirstMirror | null;
  onCodeCalculated?: (fullDate: string, calc: CalculationResult, reading?: FirstMirror) => void;
  onBackToCollection?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  onOpenAbout?: () => void;
}

export function AlabasterSanctuary({
  initialDate = '',
  initialResult = null,
  initialReading = null,
  onCodeCalculated,
  onBackToCollection,
  onContinue,
  continueLabel = 'Перейти к Личному мифу',
  onOpenAbout
}: AlabasterSanctuaryProps) {
  const [day, setDay] = useState(initialDate ? initialDate.split('.')[0] || '' : '');
  const [month, setMonth] = useState(initialDate ? initialDate.split('.')[1] || '' : '');
  const [year, setYear] = useState(initialDate ? initialDate.split('.')[2] || '' : '');
  const [dateError, setDateError] = useState('');

  const [result, setResult] = useState<CalculationResult | null>(() => {
    if (initialResult) return initialResult;
    if (initialDate && initialDate.length === 10) return calculateDigitalCode(initialDate);
    return null;
  });
  const [reading, setReading] = useState<FirstMirror | null>(() => {
    if (initialReading) return initialReading;
    if (initialResult) return generateFirstMirror(initialResult);
    if (initialDate && initialDate.length === 10) return generateFirstMirror(calculateDigitalCode(initialDate));
    return null;
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Section references for smooth 7-act editorial scroll
  const sectionAct1Ref = useRef<HTMLDivElement>(null);
  const sectionAct2Ref = useRef<HTMLDivElement>(null);
  const sectionAct3Ref = useRef<HTMLDivElement>(null);
  const sectionAct4Ref = useRef<HTMLDivElement>(null);
  const sectionAct5Ref = useRef<HTMLDivElement>(null);
  const sectionAct6Ref = useRef<HTMLDivElement>(null);
  const sectionAct7Ref = useRef<HTMLDivElement>(null);

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const executeCalculation = (fullDate: string) => {
    const calc = calculateDigitalCode(fullDate);
    const nextReading = generateFirstMirror(calc);
    setResult(calc);
    setReading(nextReading);
    if (onCodeCalculated) {
      onCodeCalculated(fullDate, calc, nextReading);
    }
  };

  useEffect(() => {
    if (initialDate && initialDate.length === 10) {
      const parts = initialDate.split('.');
      if (parts.length === 3) {
        setDay(parts[0]);
        setMonth(parts[1]);
        setYear(parts[2]);
        if (!initialResult) {
          executeCalculation(initialDate);
        }
      }
    }
  }, [initialDate, initialResult]);

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
    setDateError('');

    const validation = validateBirthDate(day, month, year);

    if (validation.valid) {
      executeCalculation(validation.formatted);
    } else {
      setDateError('message' in validation ? validation.message : 'Проверьте дату рождения');
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

  const soulVisual = ARCHETYPE_VISUALS[soulNum] || ARCHETYPE_VISUALS[1];
  const exprVisual = ARCHETYPE_VISUALS[exprNum] || ARCHETYPE_VISUALS[1];
  const pathVisual = ARCHETYPE_VISUALS[pathNum] || ARCHETYPE_VISUALS[1];

  const soulPractice = PASSPORT_PRACTICES[soulNum] || PASSPORT_PRACTICES[1];

  return (
    <div className="theme-alabaster min-h-screen w-full flex flex-col items-center selection:bg-[#C8A45D]/30 selection:text-[#1A1A1C] font-sans antialiased text-[#1A1A1C]">
      {/* ========================================================= */}
      {/* 1. INITIAL FORM SCREEN (When no result yet) */}
      {/* ========================================================= */}
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="text-center w-full max-w-2xl px-6 py-24 my-auto flex flex-col items-center"
        >
          <div className="mb-10">
            <ArchetypeBasRelief number={1} size={180} showNumber={false} />
          </div>

          <span className="text-[11px] uppercase tracking-[0.35em] text-[#C8A45D] font-mono block mb-4">
            Ведическая нумерология · Цифровой Код
          </span>

          <h1 className="font-serif text-6xl sm:text-7xl lg:text-[86px] text-[#1A1A1C] mb-6 font-light tracking-tight leading-[0.95]">
            Зеркало себя
          </h1>

          <p className="text-[18px] text-[#63656C] leading-relaxed mb-12 max-w-lg mx-auto font-light">
            У каждого человека есть свой числовой рисунок. Введите дату рождения — система рассчитает пять главных ключей и развернет их в непрерывном свитке.
          </p>

          {/* THREE CLEAN DATE FIELDS: [ ДД ] [ ММ ] [ ГГГГ ] */}
          <form onSubmit={handleCalculate} className="w-full flex flex-col items-center space-y-8 max-w-md">
            <div className="flex items-center justify-center gap-3 sm:gap-4 py-2 border-b border-[#1A1A1C]/15 focus-within:border-[#C8A45D] transition-colors w-full pb-3">
              <input
                ref={dayRef}
                type="text"
                inputMode="numeric"
                placeholder="ДД"
                maxLength={2}
                value={day}
                onChange={handleDayChange}
                onKeyDown={(e) => handleKeyDown(e, 'day')}
                className="w-16 sm:w-20 bg-transparent border-0 text-center font-serif text-3xl sm:text-4xl text-[#1A1A1C] placeholder:text-[#1A1A1C]/25 outline-none transition-colors"
                aria-label="День рождения"
              />
              <span className="text-[#C8A45D] font-serif text-2xl">·</span>
              <input
                ref={monthRef}
                type="text"
                inputMode="numeric"
                placeholder="ММ"
                maxLength={2}
                value={month}
                onChange={handleMonthChange}
                onKeyDown={(e) => handleKeyDown(e, 'month')}
                className="w-16 sm:w-20 bg-transparent border-0 text-center font-serif text-3xl sm:text-4xl text-[#1A1A1C] placeholder:text-[#1A1A1C]/25 outline-none transition-colors"
                aria-label="Месяц рождения"
              />
              <span className="text-[#C8A45D] font-serif text-2xl">·</span>
              <input
                ref={yearRef}
                type="text"
                inputMode="numeric"
                placeholder="ГГГГ"
                maxLength={4}
                value={year}
                onChange={handleYearChange}
                onKeyDown={(e) => handleKeyDown(e, 'year')}
                className="w-24 sm:w-28 bg-transparent border-0 text-center font-serif text-3xl sm:text-4xl text-[#1A1A1C] placeholder:text-[#1A1A1C]/25 outline-none transition-colors"
                aria-label="Год рождения"
              />
            </div>

            {dateError && (
              <p className="text-xs text-red-700 font-light">{dateError}</p>
            )}

            <button
              type="submit"
              disabled={isGenerating || day.length !== 2 || month.length !== 2 || year.length !== 4}
              className="w-full sm:w-auto px-10 py-4 border border-[#C8A45D] bg-[#C8A45D]/10 hover:bg-[#C8A45D]/20 text-[#1A1A1C] uppercase tracking-[0.25em] text-xs font-medium rounded-xs transition-all disabled:opacity-30 flex items-center justify-center gap-3 cursor-pointer shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#C8A45D]" />
                  <span>Рассчитываем карту природы...</span>
                </>
              ) : (
                <>
                  <span>Открыть свой код</span>
                  <ArrowRight size={14} className="text-[#C8A45D]" />
                </>
              )}
            </button>

            <p className="text-xs text-[#8C8E96] font-light leading-relaxed max-w-sm">
              Мы ничего о вас не спрашиваем. Сначала — расчет и интерпретация. А потом уже вы сами решаете, насколько это совпадает с вашей жизнью.
            </p>
          </form>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* 2. THE 7-ACT DRAMATIC MANUSCRIPT SCROLL */}
      {/* ========================================================= */}
      {result && (
        <div className="w-full max-w-4xl px-6 flex flex-col items-center relative z-10 space-y-32 sm:space-y-44 pb-32">
          
          {/* ------------------------------------------------------- */}
          {/* ACT 1 · SILENCE & MANUSCRIPT ENTRANCE (100vh) */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAct1Ref}
            className="w-full min-h-[75vh] flex flex-col items-center justify-center text-center pt-12 pb-16 border-b border-[#1A1A1C]/8"
          >
            <span className="text-[11px] uppercase tracking-[0.35em] text-[#C8A45D] font-mono block mb-4">
              Акт I · Личная формула
            </span>

            <h1 className="font-serif text-6xl sm:text-7xl lg:text-[92px] text-[#1A1A1C] font-light tracking-tight leading-none mb-6">
              {`${day}.${month}.${year}`}
            </h1>

            <p className="font-serif italic text-xl sm:text-2xl text-[#63656C] max-w-xl mx-auto leading-relaxed font-light mb-8">
              «Числа не предопределяют судьбу. Они называют силы, которые уже действуют в вашей жизни.»
            </p>

            {/* 5 KEYS ROW — РАННЯЯ НАГРАДА */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-10">
              {[
                { key: 'Душа', num: soulNum, comp: result.soulComposite, title: 'Ядро' },
                { key: 'Выражение', num: exprNum, comp: result.expressionComposite, title: 'Форма' },
                { key: 'Путь', num: pathNum, comp: result.pathComposite, title: 'Маршрут' },
                { key: 'Направление', num: dirNum, comp: result.directionComposite, title: 'Вектор' },
                { key: 'Результат', num: resNum, comp: result.resultComposite, title: 'Итог' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-5 sm:p-6 bg-[#FCFAF7] border border-[#1A1A1C]/8 rounded-xs flex flex-col items-center text-center shadow-xs"
                >
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#8C8E96] mb-3">
                    {item.key}
                  </span>
                  <ArchetypeBasRelief number={item.num} size={54} showNumber={false} className="mb-2" />
                  <span className="font-serif text-2xl text-[#1A1A1C] font-light">
                    {item.num}
                  </span>
                  <span className="text-[10px] text-[#8C8E96] font-mono mt-1">
                    {item.comp !== item.num.toString() ? item.comp : item.title}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => scrollTo(sectionAct2Ref)}
              className="px-8 py-3.5 border border-[#C8A45D]/60 bg-[#C8A45D]/10 hover:bg-[#C8A45D]/20 text-[#1A1A1C] rounded-xs uppercase tracking-[0.2em] text-xs font-medium transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Первый ключ: Кто вы внутри</span>
              <ChevronDown size={14} className="text-[#C8A45D]" />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* ACT 2 · THE SOUL (ЧИСЛО ДУШИ · ЯДРО ПРИРОДЫ) */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAct2Ref}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block">
              Акт II · Ключ I · Число Души
            </span>

            {/* 220px Optical Bas-Relief */}
            <div className="my-2">
              <ArchetypeBasRelief number={soulNum} size={220} showNumber={true} />
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-[#8C8E96] uppercase tracking-widest">
                <span>{soulVisual.planet}</span>
                <span>·</span>
                <span className="text-[#C8A45D] font-medium">{soulVisual.sanskrit}</span>
                <span>·</span>
                <span>Мотив: {soulVisual.motif}</span>
              </div>

              <h2 className="font-serif text-4xl sm:text-5xl text-[#1A1A1C] font-light">
                {soulVisual.title} ({soulNum})
              </h2>

              <p className="font-serif italic text-xl sm:text-2xl text-[#4A4B50] leading-relaxed font-light pt-2">
                «{soulInfo.positions.soul.essence}»
              </p>
            </div>

            {/* In-depth manifestation columns */}
            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 shadow-sm">
                <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-800 font-medium block mb-2">
                  Сила ядра
                </span>
                <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                  {soulInfo.positions.soul.strength}
                </p>
              </div>

              <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 shadow-sm">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#A37E2C] font-medium block mb-2">
                  Внутренний запрос
                </span>
                <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                  {soulInfo.positions.soul.tension}
                </p>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionAct3Ref)}
              className="px-8 py-3.5 border border-[#C8A45D]/60 bg-[#C8A45D]/10 hover:bg-[#C8A45D]/20 text-[#1A1A1C] rounded-xs uppercase tracking-[0.2em] text-xs font-medium transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Как вы действуете: Число Выражения</span>
              <ChevronDown size={14} className="text-[#C8A45D]" />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* ACT 3 · THE ACTION (ЧИСЛО ВЫРАЖЕНИЯ · ЯЗЫК ПРОЯВЛЕНИЯ) */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAct3Ref}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block">
              Акт III · Ключ II · Число Выражения
            </span>

            <div className="my-2">
              <ArchetypeBasRelief number={exprNum} size={180} showNumber={true} />
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-[#8C8E96] uppercase tracking-widest">
                <span>{exprVisual.planet}</span>
                <span>·</span>
                <span className="text-[#C8A45D] font-medium">{exprVisual.sanskrit}</span>
                <span>·</span>
                <span>Мотив: {exprVisual.motif}</span>
              </div>

              <h2 className="font-serif text-4xl sm:text-5xl text-[#1A1A1C] font-light">
                Паттерн проявления ({exprNum})
              </h2>

              <p className="font-serif italic text-xl sm:text-2xl text-[#4A4B50] leading-relaxed font-light pt-2">
                «{exprInfo.positions.expression.essence}»
              </p>
            </div>

            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 shadow-sm">
                <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-800 font-medium block mb-2">
                  Как вас считывает среда
                </span>
                <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                  {exprInfo.positions.expression.strength}
                </p>
              </div>

              <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 shadow-sm">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#A37E2C] font-medium block mb-2">
                  Точность контакта
                </span>
                <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                  {exprInfo.positions.expression.recommendation}
                </p>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionAct4Ref)}
              className="px-8 py-3.5 border border-[#C8A45D]/60 bg-[#C8A45D]/10 hover:bg-[#C8A45D]/20 text-[#1A1A1C] rounded-xs uppercase tracking-[0.2em] text-xs font-medium transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Что происходит, когда они встречаются</span>
              <ChevronDown size={14} className="text-[#C8A45D]" />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* ACT 4 · THE CONVERGENCE (СОПРЯЖЕНИЕ ДВУХ СИЛ) */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAct4Ref}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12 p-8 sm:p-14 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 shadow-sm"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block">
              Акт IV · Сопряжение сил · Диалог Ядра и Формы
            </span>

            {/* TWO BAS-RELIEFS SIDE BY SIDE */}
            <div className="flex items-center justify-center gap-8 sm:gap-14 my-4">
              <div className="flex flex-col items-center gap-2">
                <ArchetypeBasRelief number={soulNum} size={110} />
                <span className="text-[11px] font-mono text-[#8C8E96] uppercase tracking-wider">
                  Душа {soulNum}
                </span>
              </div>

              <span className="font-serif text-4xl text-[#C8A45D] font-light">·</span>

              <div className="flex flex-col items-center gap-2">
                <ArchetypeBasRelief number={exprNum} size={110} />
                <span className="text-[11px] font-mono text-[#8C8E96] uppercase tracking-wider">
                  Выражение {exprNum}
                </span>
              </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-4 text-left sm:text-center">
              <h3 className="font-serif text-3xl sm:text-4xl text-[#1A1A1C] font-light">
                {soulNum === exprNum 
                  ? 'Монолитный резонанс: Единая природа'
                  : `Тандем двух начал: ${soulVisual.title} и ${exprVisual.title}`}
              </h3>

              <p className="text-[16px] sm:text-[17px] text-[#4A4B50] font-light leading-relaxed pt-2">
                {soulNum === exprNum
                  ? 'Когда число Души и число Выражения совпадают, внутренняя мотивация абсолютно совпадает с внешним проявлением. Нет зазора между тем, кто вы внутри, и тем, как вас воспринимают окружающие. Это дает монолитность, но требует гибкости в адаптации.'
                  : `Внутри вас действует импульс архетипа ${soulVisual.title} (${soulVisual.planet}), тогда как в мир вы выходите через язык архетипа ${exprVisual.title} (${exprVisual.planet}). Это создает объемную многослойность: глубокая суть формулируется на более мягком или, напротив, более структурированном языке.`}
              </p>
            </div>

            <button
              onClick={() => scrollTo(sectionAct5Ref)}
              className="px-8 py-3.5 border border-[#C8A45D]/60 bg-[#C8A45D]/10 hover:bg-[#C8A45D]/20 text-[#1A1A1C] rounded-xs uppercase tracking-[0.2em] text-xs font-medium transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Где энергия ищет выход: Число Пути</span>
              <ChevronDown size={14} className="text-[#C8A45D]" />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* ACT 5 · PATH & VECTOR (РЕАЛИЗАЦИЯ И ВЕКТОР) */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAct5Ref}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-12"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block">
              Акт V · Ключи III и IV · Реализация и Вектор
            </span>

            <div className="my-2">
              <ArchetypeBasRelief number={pathNum} size={190} showNumber={true} />
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-[#8C8E96] uppercase tracking-widest">
                <span>{pathVisual.planet}</span>
                <span>·</span>
                <span className="text-[#C8A45D] font-medium">{pathVisual.sanskrit}</span>
                <span>·</span>
                <span>Мотив: {pathVisual.motif}</span>
              </div>

              <h2 className="font-serif text-4xl sm:text-5xl text-[#1A1A1C] font-light">
                Число Пути: {pathNum}
              </h2>

              <p className="font-serif italic text-xl sm:text-2xl text-[#4A4B50] leading-relaxed font-light pt-2">
                «{pathInfo.positions.path.essence}»
              </p>
            </div>

            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 shadow-sm">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#A37E2C] font-medium block mb-2">
                  Траектория реализации (Путь {pathNum})
                </span>
                <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                  {pathInfo.positions.path.strength}
                </p>
              </div>

              <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 shadow-sm">
                <span className="text-[10px] uppercase font-mono tracking-wider text-purple-900 font-medium block mb-2">
                  Вектор применения (Направление {dirNum})
                </span>
                <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                  {dirInfo.positions.direction.essence}
                </p>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionAct6Ref)}
              className="px-8 py-3.5 border border-[#C8A45D]/60 bg-[#C8A45D]/10 hover:bg-[#C8A45D]/20 text-[#1A1A1C] rounded-xs uppercase tracking-[0.2em] text-xs font-medium transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Место напряжения и Тень</span>
              <ChevronDown size={14} className="text-[#C8A45D]" />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* ACT 6 · THE SHADOW (МЕСТО НАПРЯЖЕНИЯ И ТЕНЬ) */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAct6Ref}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-10"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#9E6A1B] block font-medium">
              Акт VI · Тень и Зона Внимания
            </span>

            <div className="max-w-2xl mx-auto space-y-4">
              <h2 className="font-serif text-4xl sm:text-5xl text-[#1A1A1C] font-light">
                Точка слива ресурса
              </h2>

              <p className="text-[16px] text-[#63656C] font-light leading-relaxed pt-2">
                Тень — это не недостаток, а избыток неприрученной силы. Знание своей ловушки позволяет вовремя вернуть управление.
              </p>
            </div>

            <div className="w-full max-w-3xl p-8 sm:p-10 rounded-xs bg-[#FCFAF7] border border-[#C8A45D]/40 text-left space-y-6 shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-mono text-[#9E6A1B] tracking-wider block mb-1 font-medium">
                  Ловушка архетипа {soulVisual.title} ({soulNum})
                </span>
                <p className="font-serif text-2xl sm:text-3xl text-[#1A1A1C] font-light">
                  {soulInfo.shadow}
                </p>
              </div>

              <div className="border-t border-[#1A1A1C]/8 pt-4 flex items-center gap-3">
                <span className="text-[10px] uppercase font-mono text-[#C8A45D] tracking-wider font-semibold">
                  Ключ к равновесию:
                </span>
                <span className="text-xs text-[#4A4B50] font-light">
                  {soulInfo.practicalKey}
                </span>
              </div>
            </div>

            <button
              onClick={() => scrollTo(sectionAct7Ref)}
              className="px-8 py-3.5 border border-[#C8A45D]/60 bg-[#C8A45D]/10 hover:bg-[#C8A45D]/20 text-[#1A1A1C] rounded-xs uppercase tracking-[0.2em] text-xs font-medium transition-all inline-flex items-center gap-2 cursor-pointer mt-4"
            >
              <span>Показать карту целиком и триптих практик</span>
              <ChevronDown size={14} className="text-[#C8A45D]" />
            </button>
          </section>

          {/* ------------------------------------------------------- */}
          {/* ACT 7 · SYNTHESIS, PRACTICES & ALBERT BRIDGE */}
          {/* ------------------------------------------------------- */}
          <section
            ref={sectionAct7Ref}
            className="w-full scroll-mt-24 flex flex-col items-center text-center space-y-16"
          >
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block">
                Акт VII · Синтез структуры
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl text-[#1A1A1C] font-light">
                Полная карта кода ({day}.{month}.{year})
              </h2>
            </div>

            {/* FIRST MIRROR / MEETING EVIDENCE SYNTHESIS BLOCK */}
            {reading && (
              <div className="w-full bg-[#FCFAF7] border border-[#C8A45D]/40 p-8 sm:p-10 rounded-xs text-left shadow-xs space-y-6">
                <div className="space-y-2 text-center sm:text-left">
                  <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block font-medium">
                    Смысловой узор Кода · Материал для Встречи зеркал
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-[#1A1A1C] font-light">
                    {reading.title || 'Синтез формулы'}
                  </h3>
                  {reading.keyInsight && (
                    <p className="font-serif italic text-base sm:text-lg text-[#4A4B50] font-light pt-1">
                      «{reading.keyInsight}»
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {reading.blocks?.find(b => b.id === 'main_pattern') && (
                    <div className="p-5 rounded-xs bg-[#F8F6F1] border border-[#1A1A1C]/8 space-y-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#8C8E96] block font-medium">
                        Главный узор
                      </span>
                      <p className="text-xs text-[#4A4B50] font-light leading-relaxed">
                        {reading.blocks.find(b => b.id === 'main_pattern')?.text}
                      </p>
                    </div>
                  )}

                  {reading.blocks?.find(b => b.id === 'strength') && (
                    <div className="p-5 rounded-xs bg-[#F8F6F1] border border-[#1A1A1C]/8 space-y-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-800 block font-medium">
                        Зона силы
                      </span>
                      <p className="text-xs text-[#4A4B50] font-light leading-relaxed">
                        {reading.blocks.find(b => b.id === 'strength')?.text}
                      </p>
                    </div>
                  )}

                  {reading.blocks?.find(b => b.id === 'tension') && (
                    <div className="p-5 rounded-xs bg-[#F8F6F1] border border-[#1A1A1C]/8 space-y-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#9E6A1B] block font-medium">
                        Зона напряжения
                      </span>
                      <p className="text-xs text-[#4A4B50] font-light leading-relaxed">
                        {reading.blocks.find(b => b.id === 'tension')?.text}
                      </p>
                    </div>
                  )}
                </div>

                {reading.practicalStep && (
                  <div className="border-t border-[#1A1A1C]/8 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-[10px] uppercase font-mono text-[#C8A45D] tracking-wider font-semibold">
                      Рекомендованный шаг:
                    </span>
                    <span className="text-[#4A4B50] font-light">
                      {reading.practicalStep}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 3x3 MATRIX */}
            <div className="w-full bg-[#FCFAF7] border border-[#1A1A1C]/8 p-8 sm:p-12 rounded-xs text-center shadow-xs">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block mb-2">
                Матрица качеств
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#1A1A1C] font-light mb-8">
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
                          ? 'bg-[#F8F6F1] border-[#C8A45D]/40' 
                          : 'bg-[#F8F6F1]/40 border-[#1A1A1C]/5 text-[#8C8E96]'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-[#8C8E96] block">
                        {cell.digit} · {cell.name.split(',')[0]}
                      </span>
                      <span className={`font-serif text-2xl font-light ${count > 0 ? 'text-[#C8A45D]' : 'text-stone-400'}`}>
                        {count > 0 ? cell.digit.repeat(count) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-[#63656C] font-light max-w-md mx-auto leading-relaxed">
                Матрица отражает распределение ресурсных качеств, плотности энергии и зон внимания в структуре личности.
              </p>
            </div>

            {/* TRIPTYCH OF PRACTICES */}
            <div className="w-full space-y-6 text-left">
              <div className="text-center">
                <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block mb-2">
                  Интеграция в жизнь
                </span>
                <h3 className="font-serif text-3xl sm:text-4xl text-[#1A1A1C] font-light">
                  Триптих практик архетипа {soulVisual.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Observation */}
                <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 text-emerald-800 text-[10px] uppercase font-mono tracking-wider font-semibold">
                    <Eye size={13} />
                    <span>01 · Наблюдение</span>
                  </div>
                  <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                    {soulPractice.observation.insight}
                  </p>
                  <span className="text-[11px] text-[#8C8E96] font-mono block pt-2 border-t border-[#1A1A1C]/5">
                    Маркер: {soulPractice.observation.bodyMarker}
                  </span>
                </div>

                {/* 2. Action */}
                <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 text-[#9E6A1B] text-[10px] uppercase font-mono tracking-wider font-semibold">
                    <Zap size={13} />
                    <span>02 · Действие</span>
                  </div>
                  <p className="text-sm text-[#4A4B50] font-light leading-relaxed">
                    {soulPractice.action.microStep}
                  </p>
                  <span className="text-[11px] text-[#8C8E96] font-mono block pt-2 border-t border-[#1A1A1C]/5">
                    Ритуал: {soulPractice.action.ritual}
                  </span>
                </div>

                {/* 3. Integration */}
                <div className="p-8 rounded-xs bg-[#FCFAF7] border border-[#1A1A1C]/8 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 text-purple-900 text-[10px] uppercase font-mono tracking-wider font-semibold">
                    <Shield size={13} />
                    <span>03 · Интеграция</span>
                  </div>
                  <p className="font-serif italic text-base text-[#1A1A1C] leading-relaxed">
                    «{soulPractice.integration.focusMantra}»
                  </p>
                  <span className="text-[11px] text-[#8C8E96] font-mono block pt-2 border-t border-[#1A1A1C]/5">
                    Ключ: {soulPractice.integration.balanceKey}
                  </span>
                </div>
              </div>
            </div>

            {/* NEXT INDEPENDENT MIRROR */}
            <div className="w-full p-8 sm:p-14 rounded-xs bg-[#FCFAF7] border border-[#C8A45D]/40 shadow-sm space-y-8">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#C8A45D] block">
                Следующий зал · Независимое отражение
              </span>

              <div className="max-w-2xl mx-auto space-y-3">
                <h3 className="font-serif text-3xl sm:text-5xl text-[#1A1A1C] font-light">
                  Личный миф
                </h3>
                <p className="text-[16px] text-[#63656C] font-light leading-relaxed">
                  Код возник из даты. Второе зеркало складывается только из ваших образов — дата и числа в него не передаются.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                {onContinue && (
                  <button
                    onClick={onContinue}
                    className="px-8 py-3.5 bg-[#1A1A1C] text-[#F8F6F1] uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#2C2C30] transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <span>{continueLabel}</span>
                    <ArrowRight size={14} className="text-[#C8A45D]" />
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="px-5 py-3.5 text-xs uppercase tracking-wider text-[#8C8E96] hover:text-[#1A1A1C] transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Рассчитать другую дату"
                >
                  <RotateCcw size={13} />
                  <span>Другая дата</span>
                </button>
              </div>
            </div>

          </section>

        </div>
      )}

    </div>
  );
}

export default AlabasterSanctuary;
