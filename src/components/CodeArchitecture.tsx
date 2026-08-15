import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  ChevronLeft, 
  Loader2, 
  Eye, 
  Zap, 
  Sparkles, 
  RotateCcw, 
  GitFork,
  X
} from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { CalculationResult, FirstMirror, ApiResponse } from '../types';
import { calculateDigitalCode } from '../services/calculator';
import { generateFirstMirror } from '../services/interpretation';
import { numberKnowledge } from '../data/numberKnowledge';
import { PASSPORT_PRACTICES } from '../data/passportPractices';
import { Orb } from './Orb';

registerLocale('ru', ru);

interface CodeArchitectureProps {
  onOpenAbout?: () => void;
  onCodeCalculated?: (calc: CalculationResult, reading?: FirstMirror) => void;
  onNavigateToMeeting?: () => void;
  hasMythResult?: boolean;
}

export default function CodeArchitecture({ 
  onOpenAbout,
  onCodeCalculated,
  onNavigateToMeeting,
  hasMythResult
}: CodeArchitectureProps = {}) {
  const [date, setDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [reading, setReading] = useState<FirstMirror | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(true);
  
  // Reveal step: 1 = Soul, 2 = Expression, 3 = Path, 4 = Direction & Result, 5 = Full Map
  const [revealStep, setRevealStep] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCalculate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!consentChecked) return;
    setErrorInfo(null);

    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = date.match(regex);

    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);

      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year >= 1900 && year <= 2099) {
        const calc = calculateDigitalCode(date);
        setResult(calc);
        setRevealStep(1);
        setIsGenerating(true);

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'code', date, calc })
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
      } else {
        setErrorInfo("Некорректная дата. Проверьте день, месяц и год.");
      }
    } else {
      setErrorInfo("Формат даты: ДД.ММ.ГГГГ");
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to render practice triptych
  const renderPractices = (num: number) => {
    const practice = PASSPORT_PRACTICES[num] || PASSPORT_PRACTICES[1];
    return (
      <div className="w-full mt-8 pt-8 border-t border-white/[0.06] space-y-4 text-left">
        <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)]/80 block">
          Триптих практик архетипа
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Observation */}
          <div className="p-4 bg-[#0B0F18]/90 border border-white/[0.06] rounded-xs">
            <div className="flex items-center gap-1.5 text-xs text-[#A3B8AD] font-medium mb-2">
              <Eye size={14} />
              <span>Наблюдение</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed font-light mb-2">
              {practice.observation.insight}
            </p>
            <span className="text-[10px] text-stone-500 font-mono block">
              Маркер: {practice.observation.bodyMarker}
            </span>
          </div>

          {/* Action */}
          <div className="p-4 bg-[#0B0F18]/90 border border-white/[0.06] rounded-xs">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-antique-gold)] font-medium mb-2">
              <Zap size={14} />
              <span>Действие</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed font-light mb-2">
              {practice.action.microStep}
            </p>
            <span className="text-[10px] text-stone-500 font-mono block">
              Ритуал: {practice.action.ritual}
            </span>
          </div>

          {/* Integration */}
          <div className="p-4 bg-[#0B0F18]/90 border border-white/[0.06] rounded-xs">
            <div className="flex items-center gap-1.5 text-xs text-purple-300 font-medium mb-2">
              <Sparkles size={14} />
              <span>Интеграция</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed font-serif italic mb-2">
              «{practice.integration.focusMantra}»
            </p>
            <span className="text-[10px] text-stone-500 font-mono block">
              Ключ: {practice.integration.balanceKey}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] py-12 px-4 sm:px-6 lg:px-8 text-[#EAEAEA] font-sans relative overflow-x-hidden w-full selection:bg-[var(--color-antique-gold)]/20 selection:text-white"
    >
      <div className="w-full max-w-4xl flex flex-col items-center relative z-10 my-auto">
        
        {/* ========================================================= */}
        {/* 1. INITIAL FORM SCREEN */}
        {/* ========================================================= */}
        {!result && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center w-full max-w-xl mx-auto py-8"
          >
            <div className="flex justify-center mb-8">
              <Orb number={1} size="lg" glow={true} />
            </div>

            <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-antique-gold)]/90 font-mono block mb-3">
              Линза II · Цифровой Код
            </span>

            <h1 className="font-serif text-4xl sm:text-6xl text-stone-100 mb-4 font-light tracking-tight leading-tight">
              Архитектура природы
            </h1>

            <p className="text-base sm:text-lg text-stone-300/80 leading-relaxed mb-10 max-w-md mx-auto font-light">
              Введите дату рождения. Система рассчитает пять главных ключей и откроет их в пошаговом ритуале.
            </p>

            {/* Date Input Form */}
            <form onSubmit={handleCalculate} className="w-full flex flex-col items-center space-y-6">
              
              <div className="relative w-full max-w-xs flex items-center border-b border-[var(--color-antique-gold)]/40 focus-within:border-[var(--color-antique-gold)] transition-colors py-2">
                <DatePicker
                  selected={selectedDate}
                  onChangeRaw={(e) => {
                    const target = e?.target as HTMLInputElement | undefined;
                    if (!target || typeof target.value !== 'string') return;
                    const prev = target.value;
                    let val = prev.replace(/[^\d]/g, '');
                    if (val.length > 2) val = val.substring(0, 2) + '.' + val.substring(2);
                    if (val.length > 5) val = val.substring(0, 5) + '.' + val.substring(5, 9);
                    setDate(val);
                  }}
                  onChange={(d: Date | null) => {
                    setSelectedDate(d);
                    if (d) {
                      const dayStr = String(d.getDate()).padStart(2, '0');
                      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
                      const yearStr = String(d.getFullYear());
                      setDate(`${dayStr}.${monthStr}.${yearStr}`);
                    } else {
                      setDate('');
                    }
                  }}
                  dateFormat="dd.MM.yyyy"
                  locale="ru"
                  showYearDropdown
                  showMonthDropdown
                  dropdownMode="select"
                  placeholderText="ДД.ММ.ГГГГ"
                  className="w-full bg-transparent text-center font-serif text-2xl sm:text-3xl text-stone-100 placeholder:text-stone-600 outline-none"
                  wrapperClassName="w-full"
                />

                {date && (
                  <button
                    type="button"
                    onClick={() => { setDate(''); setSelectedDate(null); }}
                    className="p-1 text-stone-500 hover:text-stone-200"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {errorInfo && (
                <p className="text-xs text-red-400 font-light">{errorInfo}</p>
              )}

              <button
                type="submit"
                disabled={isGenerating || date.length !== 10}
                className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] disabled:opacity-30 disabled:hover:bg-[var(--color-antique-gold)] transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Рассчитываем...</span>
                  </>
                ) : (
                  <>
                    <span>Рассчитать код</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              {/* Consent & About */}
              <div className="pt-2 flex items-center justify-center gap-4 text-xs text-stone-400 font-light">
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
        {/* 2. RITUAL STEP-BY-STEP REVEAL (Steps 1 to 5) */}
        {/* ========================================================= */}
        {result && (
          <div className="w-full flex flex-col items-center">
            
            {/* Top Reveal Status Bar */}
            <div className="w-full flex items-center justify-between py-4 mb-8 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[var(--color-antique-gold)]" />
                <span className="text-xs uppercase font-mono tracking-[0.25em] text-stone-400">
                  {revealStep < 5 
                    ? `Шаг ${revealStep} из 5 · Раскрытие карты` 
                    : 'Вся карта раскрыта'}
                </span>
              </div>

              {revealStep < 5 && (
                <button
                  onClick={() => { setRevealStep(5); scrollToTop(); }}
                  className="text-xs uppercase font-mono tracking-wider text-[var(--color-antique-gold)]/80 hover:text-[var(--color-antique-gold)] hover:underline transition-colors"
                >
                  Показать всю карту сразу →
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">

              {/* --------------------------------------------------- */}
              {/* STEP 1: ЧИСЛО ДУШИ */}
              {/* --------------------------------------------------- */}
              {revealStep === 1 && (() => {
                const num = result.soul;
                const info = numberKnowledge[num] || numberKnowledge[1];
                const pos = info.positions.soul;
                return (
                  <motion.div
                    key="step-1-soul"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.6 }}
                    className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-8 sm:p-12 rounded-xs text-center"
                  >
                    <Orb number={num} size="xl" glow={true} className="mx-auto mb-6" />

                    <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-2">
                      Ключ 1 · Внутреннее Ядро
                    </span>

                    <h2 className="font-serif text-3xl sm:text-5xl text-stone-100 mb-2 font-light">
                      Число Души: {num}
                    </h2>
                    
                    <span className="text-xs text-stone-400 font-mono uppercase tracking-wider block mb-6">
                      {info.planet} · Состав: {result.soulComposite}
                    </span>

                    <p className="font-serif italic text-lg sm:text-xl text-[#C9C0AE] max-w-xl mx-auto mb-8 font-light leading-relaxed">
                      «{pos.essence}»
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left mb-6">
                      <div className="p-4 bg-[#0B0F18] border border-emerald-500/20 rounded-xs">
                        <span className="text-[10px] uppercase font-mono text-emerald-400 block mb-1">Сила ядра</span>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">{pos.strength}</p>
                      </div>
                      <div className="p-4 bg-[#0B0F18] border border-amber-500/20 rounded-xs">
                        <span className="text-[10px] uppercase font-mono text-amber-400 block mb-1">Точка напряжения</span>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">{pos.tension}</p>
                      </div>
                    </div>

                    {renderPractices(num)}

                    <div className="pt-10 flex justify-center">
                      <button
                        onClick={() => { setRevealStep(2); scrollToTop(); }}
                        className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <span>Далее: Число Выражения</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {/* --------------------------------------------------- */}
              {/* STEP 2: ЧИСЛО ВЫРАЖЕНИЯ */}
              {/* --------------------------------------------------- */}
              {revealStep === 2 && (() => {
                const num = result.expression;
                const info = numberKnowledge[num] || numberKnowledge[1];
                const pos = info.positions.expression;
                return (
                  <motion.div
                    key="step-2-expression"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.6 }}
                    className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-8 sm:p-12 rounded-xs text-center"
                  >
                    <div className="flex items-center justify-center gap-6 mb-6">
                      <Orb number={result.soul} size="sm" glow={false} />
                      <span className="text-xs font-mono text-stone-500">↔</span>
                      <Orb number={num} size="lg" glow={true} />
                    </div>

                    <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-2">
                      Ключ 2 · Встреча двух сил (Ядро + Внешняя форма)
                    </span>

                    <h2 className="font-serif text-3xl sm:text-5xl text-stone-100 mb-2 font-light">
                      Число Выражения: {num}
                    </h2>
                    
                    <span className="text-xs text-stone-400 font-mono uppercase tracking-wider block mb-6">
                      {info.planet} · Состав: {result.expressionComposite}
                    </span>

                    <p className="font-serif italic text-lg sm:text-xl text-[#C9C0AE] max-w-xl mx-auto mb-8 font-light leading-relaxed">
                      «{pos.essence}»
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left mb-6">
                      <div className="p-4 bg-[#0B0F18] border border-emerald-500/20 rounded-xs">
                        <span className="text-[10px] uppercase font-mono text-emerald-400 block mb-1">Как вас считывает мир</span>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">{pos.strength}</p>
                      </div>
                      <div className="p-4 bg-[#0B0F18] border border-amber-500/20 rounded-xs">
                        <span className="text-[10px] uppercase font-mono text-amber-400 block mb-1">Рекомендация контакта</span>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">{pos.recommendation}</p>
                      </div>
                    </div>

                    {renderPractices(num)}

                    <div className="pt-10 flex items-center justify-center gap-4">
                      <button
                        onClick={() => { setRevealStep(1); scrollToTop(); }}
                        className="px-6 py-3 border border-white/15 text-stone-400 hover:text-stone-200 uppercase tracking-wider text-xs rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Назад</span>
                      </button>
                      <button
                        onClick={() => { setRevealStep(3); scrollToTop(); }}
                        className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <span>Далее: Число Пути</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {/* --------------------------------------------------- */}
              {/* STEP 3: ЧИСЛО ПУТИ */}
              {/* --------------------------------------------------- */}
              {revealStep === 3 && (() => {
                const num = result.path;
                const info = numberKnowledge[num] || numberKnowledge[1];
                const pos = info.positions.path;
                return (
                  <motion.div
                    key="step-3-path"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.6 }}
                    className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-8 sm:p-12 rounded-xs text-center"
                  >
                    <Orb number={num} size="xl" glow={true} className="mx-auto mb-6" />

                    <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-2">
                      Ключ 3 · Движение в мире
                    </span>

                    <h2 className="font-serif text-3xl sm:text-5xl text-stone-100 mb-2 font-light">
                      Число Пути: {num}
                    </h2>
                    
                    <span className="text-xs text-stone-400 font-mono uppercase tracking-wider block mb-6">
                      {info.planet} · Состав: {result.pathComposite}
                    </span>

                    <p className="font-serif italic text-lg sm:text-xl text-[#C9C0AE] max-w-xl mx-auto mb-8 font-light leading-relaxed">
                      «{pos.essence}»
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left mb-6">
                      <div className="p-4 bg-[#0B0F18] border border-emerald-500/20 rounded-xs">
                        <span className="text-[10px] uppercase font-mono text-emerald-400 block mb-1">Маршрут успеха</span>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">{pos.strength}</p>
                      </div>
                      <div className="p-4 bg-[#0B0F18] border border-amber-500/20 rounded-xs">
                        <span className="text-[10px] uppercase font-mono text-amber-400 block mb-1">Ловушка пути</span>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">{pos.tension}</p>
                      </div>
                    </div>

                    {renderPractices(num)}

                    <div className="pt-10 flex items-center justify-center gap-4">
                      <button
                        onClick={() => { setRevealStep(2); scrollToTop(); }}
                        className="px-6 py-3 border border-white/15 text-stone-400 hover:text-stone-200 uppercase tracking-wider text-xs rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Назад</span>
                      </button>
                      <button
                        onClick={() => { setRevealStep(4); scrollToTop(); }}
                        className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <span>Далее: Направление & Результат</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {/* --------------------------------------------------- */}
              {/* STEP 4: ЧИСЛО НАПРАВЛЕНИЯ & РЕЗУЛЬТАТА */}
              {/* --------------------------------------------------- */}
              {revealStep === 4 && (() => {
                const dirNum = result.direction;
                const resNum = result.result;
                const dirInfo = numberKnowledge[dirNum] || numberKnowledge[1];
                const resInfo = numberKnowledge[resNum] || numberKnowledge[1];

                return (
                  <motion.div
                    key="step-4-vector-result"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.6 }}
                    className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-8 sm:p-12 rounded-xs text-center space-y-8"
                  >
                    <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block">
                      Ключи 4 и 5 · Вектор реализации и Зрелый итог
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                      {/* Direction */}
                      <div className="p-6 bg-[#0B0F18] border border-white/[0.06] rounded-xs flex flex-col items-center text-center">
                        <Orb number={dirNum} size="md" glow={true} className="mb-4" />
                        <span className="text-[10px] uppercase font-mono text-stone-500 block mb-1">
                          Число Направления ({result.directionComposite})
                        </span>
                        <h3 className="font-serif text-2xl text-stone-100 mb-3">
                          {dirInfo.archetypeName} ({dirNum})
                        </h3>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">
                          {dirInfo.positions.direction.essence}
                        </p>
                      </div>

                      {/* Result */}
                      <div className="p-6 bg-[#0B0F18] border border-white/[0.06] rounded-xs flex flex-col items-center text-center">
                        <Orb number={resNum} size="md" glow={true} className="mb-4" />
                        <span className="text-[10px] uppercase font-mono text-stone-500 block mb-1">
                          Число Результата ({result.resultComposite})
                        </span>
                        <h3 className="font-serif text-2xl text-stone-100 mb-3">
                          {resInfo.archetypeName} ({resNum})
                        </h3>
                        <p className="text-xs text-stone-300 font-light leading-relaxed">
                          {resInfo.positions.result.essence}
                        </p>
                      </div>
                    </div>

                    {renderPractices(dirNum)}

                    <div className="pt-8 flex items-center justify-center gap-4">
                      <button
                        onClick={() => { setRevealStep(3); scrollToTop(); }}
                        className="px-6 py-3 border border-white/15 text-stone-400 hover:text-stone-200 uppercase tracking-wider text-xs rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Назад</span>
                      </button>
                      <button
                        onClick={() => { setRevealStep(5); scrollToTop(); }}
                        className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <span>Открыть всю карту целиком</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {/* --------------------------------------------------- */}
              {/* STEP 5: FULL COMPREHENSIVE MAP */}
              {/* --------------------------------------------------- */}
              {revealStep === 5 && (
                <motion.div
                  key="step-5-full-map"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="w-full flex flex-col items-center space-y-12"
                >
                  {/* Overview Cards (The 5 Keys) */}
                  <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { key: 'Душа', num: result.soul, comp: result.soulComposite, title: 'Ядро' },
                      { key: 'Выражение', num: result.expression, comp: result.expressionComposite, title: 'Форма' },
                      { key: 'Путь', num: result.path, comp: result.pathComposite, title: 'Маршрут' },
                      { key: 'Направление', num: result.direction, comp: result.directionComposite, title: 'Вектор' },
                      { key: 'Результат', num: result.result, comp: result.resultComposite, title: 'Итог' }
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-5 bg-[#0D121D]/80 border border-white/[0.06] rounded-xs flex flex-col items-center text-center"
                      >
                        <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-2">
                          {item.key}
                        </span>
                        <Orb number={item.num} size="sm" glow={false} className="mb-2" />
                        <span className="font-serif text-xl text-stone-100 font-normal">
                          {item.num}
                        </span>
                        <span className="text-[9px] text-stone-500 font-mono">
                          {item.comp !== item.num.toString() ? item.comp : item.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 3x3 Quality Matrix */}
                  <div className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-6 sm:p-10 rounded-xs text-center">
                    <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-2">
                      Матрица качеств
                    </span>
                    <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-8">
                      Карта потенциалов ({date})
                    </h3>

                    <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto mb-8">
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
                            className={`p-4 rounded-xs border text-center flex flex-col justify-between min-h-[90px] ${
                              count > 0 
                                ? 'bg-[#121927] border-[var(--color-antique-gold)]/30' 
                                : 'bg-[#090D15]/50 border-white/5 text-stone-600'
                            }`}
                          >
                            <span className="text-[10px] font-mono text-stone-400 block">
                              {cell.digit} · {cell.name.split(',')[0]}
                            </span>
                            <span className={`font-serif text-xl sm:text-2xl font-light ${count > 0 ? 'text-[var(--color-antique-gold)]' : 'text-stone-600'}`}>
                              {count > 0 ? cell.digit.repeat(count) : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-stone-400 font-light max-w-md mx-auto leading-relaxed">
                      Матрица отражает распределение ресурсных качеств, плотности энергии и зон внимания.
                    </p>
                  </div>

                  {/* Soul Key Practices Detailed */}
                  <div className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-6 sm:p-10 rounded-xs">
                    <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-4">
                      Главный фокус интеграции (Число Души {result.soul})
                    </span>
                    {renderPractices(result.soul)}
                  </div>

                  {/* NEXT STEP: MEETING OF MIRRORS */}
                  <div className="w-full bg-[#0D121D]/80 border border-white/[0.08] p-8 sm:p-10 rounded-xs text-center space-y-6">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block mb-2">
                        Синтез зеркал
                      </span>
                      <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-2">
                        Встреча Кода и Личного Мифа
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-400 font-light max-w-md mx-auto leading-relaxed">
                        {hasMythResult
                          ? 'Ваш Личный Миф уже создан. Перейдите к синтезу для сопоставления двух независимых отражений.'
                          : 'Пройдите образный ритуал (4 вопроса), чтобы сопоставить математическую карту со сказкой вашего состояния.'}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                      {onNavigateToMeeting && (
                        <button 
                          onClick={onNavigateToMeeting}
                          className="px-8 py-3.5 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.2em] text-xs font-semibold rounded-xs hover:bg-[#D9B770] transition-all flex items-center gap-2 cursor-pointer shadow-md"
                        >
                          <GitFork size={15} />
                          <span>{hasMythResult ? 'Открыть Встречу Зеркал' : 'Войти в Личный Миф'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setResult(null);
                          setDate('');
                          setSelectedDate(null);
                          setRevealStep(1);
                        }}
                        className="px-5 py-3 text-xs uppercase tracking-wider text-stone-400 hover:text-stone-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Рассчитать другую дату</span>
                      </button>
                    </div>
                  </div>

                </motion.div>
              )}

            </AnimatePresence>

          </div>
        )}

      </div>
    </div>
  );
}
