import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, ArrowRight, Loader2, X, BookOpen, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { CalculationResult, ApiResponse, FirstMirror } from '../types';

registerLocale('ru', ru);
import { calculateDigitalCode } from '../services/calculator';
import { generateFirstMirror } from '../services/interpretation';
import { numberKnowledge } from '../data/numberKnowledge';
import { FirstMirrorPanel } from './FirstMirrorPanel';
import { BigResearchTeaser } from './BigResearchTeaser';
import { CompatibilityPanel } from './CompatibilityPanel';
import { LeadModal } from './LeadModal';
import { AssociativeCloud } from './AssociativeCloud';
import { QuoteOfTheDay } from './QuoteOfTheDay';
import { saveElementAsPdf } from '../lib/pdfUtils';

const playMagicalChime = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const playTone = (freq: number, startTime: number, duration: number, vol: number = 0.1) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(vol, startTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        const now = ctx.currentTime;
        playTone(587.33, now, 2, 0.1);      // D5
        playTone(739.99, now + 0.15, 2, 0.1); // F#5
        playTone(880.00, now + 0.3, 3, 0.1);  // A5
        playTone(1174.66, now + 0.45, 4, 0.1); // D6
    } catch (e) {
        // ignore audio errors
    }
};

const NUM_LINES: Record<string, string[]> = {
  '1': ['r1', 'c1', 'd1'], '4': ['r1', 'c2'], '7': ['r1', 'c3', 'd2'],
  '2': ['r2', 'c1'], '5': ['r2', 'c2', 'd1', 'd2'], '8': ['r2', 'c3'],
  '3': ['r3', 'c1', 'd2'], '6': ['r3', 'c2'], '9': ['r3', 'c3', 'd1']
};

const LINE_STYLES: Record<string, { bg: string, bgEmpty: string, text: string }> = {
  'r': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-antique-gold)]' },
  'c': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-antique-gold)]' },
  'd': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-antique-gold)]' }
};

const MATRIX_CELL_MEANS: Record<string, string> = {
  '1': 'Характер, воля',
  '2': 'Энергия, действия',
  '3': 'Интерес, познание',
  '4': 'Здоровье, тело',
  '5': 'Логика, интуиция',
  '6': 'Труд, мастерство',
  '7': 'Везение, удача',
  '8': 'Долг, терпимость',
  '9': 'Память, ум'
};

const MATRIX_LINE_MEANS: Record<string, string> = {
  'r1': 'Целеустремленность (1-4-7)',
  'r2': 'Семейственность (2-5-8)',
  'r3': 'Стабильность (3-6-9)',
  'c1': 'Самооценка (1-2-3)',
  'c2': 'Материальное (4-5-6)',
  'c3': 'Талант (7-8-9)',
  'd1': 'Внутренний компас (1-5-9)',
  'd2': 'Темперамент (3-5-7)'
};

const MeanderDivider = () => (
  <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto my-8 opacity-40">
    <path d="M0 6H10V1H20V11H30V6H40V1H50V11H60V6H70V1H80V11H90V6H100V1H110V11H120" stroke="var(--color-antique-gold)" strokeWidth="0.5" strokeMiterlimit="10"/>
  </svg>
);

export default function CodeArchitecture() {
  const [date, setDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [reading, setReading] = useState<FirstMirror | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string, type: string } | null>(null);
  const [matrixType, setMatrixType] = useState<'base' | 'detailed'>('detailed');
  const [hoveredLines, setHoveredLines] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectedMainNumber, setSelectedMainNumber] = useState<{title: string, value: number, pos: string} | null>(null);
  const [taleModal, setTaleModal] = useState<{title: string, text: string} | null>(null);
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadSource, setLeadSource] = useState('code_big_research');
  const [demoNotice, setDemoNotice] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

  const matrixRef = useRef<HTMLDivElement>(null);
  
  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) return;
    setErrorInfo(null);
    setSelectedCell(null);
    setHoveredLines([]);
    
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match1 = date.match(regex);
    
    if (match1) {
      const day1 = parseInt(match1[1], 10);
      const month1 = parseInt(match1[2], 10);
      
      if (day1 > 0 && day1 <= 31 && month1 > 0 && month1 <= 12) {
        const calc = calculateDigitalCode(date);
        
        setResult(calc);
        setReading(null);
        setDemoNotice('');
        setIsGenerating(true);
        playMagicalChime();

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'code', date, calc })
          });
          
          const data: ApiResponse = await res.json();
          if (data.status === 'ok' && data.code_result?.first_mirror) {
            setReading(data.code_result.first_mirror);
          } else if (data.status === 'error' || data.status === 'demo') {
             if (data.ui?.safe_message && data.status === 'demo') {
               setDemoNotice(data.ui.safe_message);
               setReading(data.code_result?.first_mirror || generateFirstMirror(calc));
             } else if (data.status === 'error' && data.ui?.safe_message) {
               setErrorInfo({ message: data.ui.safe_message, type: "network" });
               setDemoNotice("Показана базовая версия первого слоя.");
               setReading(data.code_result?.first_mirror || generateFirstMirror(calc));
             } else {
               setDemoNotice("Показана базовая версия первого слоя.");
               setReading(data.code_result?.first_mirror || generateFirstMirror(calc));
             }
          } else if (data.code_result?.first_mirror) {
             setReading(data.code_result.first_mirror);
          } else {
             setReading(generateFirstMirror(calc));
          }
        } catch (err) {
          console.error(err);
          setErrorInfo({ message: "Ошибка при получении данных. Пожалуйста, проверьте подключение к интернету.", type: "network" });
          setReading(generateFirstMirror(calc));
        } finally {
          setIsGenerating(false);
          setTimeout(() => {
             matrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      } else {
        setErrorInfo({ message: "Некорректная дата. Проверьте день и месяц.", type: "validation" });
      }
    } else {
      setErrorInfo({ message: "Формат: ДД.ММ.ГГГГ", type: "validation" });
    }
  };

  const handlePdfRequest = async (sourceUrl?: string) => {
    setLeadSource(sourceUrl || 'code_big_research');
    setShowLeadModal(true);
  };

      const NumberCard = ({ title, pos, value, composite, delay }: { title: string, pos: string, value: number, composite: string, delay: number }) => {
    const isSelected = selectedMainNumber?.title === title;
    const numKey = value === 11 ? 11 : (value > 9 ? value % 9 || 9 : value); // handle higher numbers if happen
    const numInfo = numberKnowledge[numKey] || numberKnowledge[1];
    
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <motion.div 
        role="button"
        tabIndex={0}
        onClick={() => setSelectedMainNumber(isSelected ? null : {title, value, pos})}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedMainNumber(isSelected ? null : {title, value, pos})}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, scale: isSelected ? 1.02 : 1 }}
        transition={{ duration: 0.8, delay: (isSelected) ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
        className={`flex flex-col items-center p-8 md:p-10 bg-[var(--color-surface)] bg-marble cursor-pointer ${isSelected ? 'bg-kraft z-10 shadow-[0_40px_100px_rgba(30,25,18,0.18)]' : 'hover:bg-[var(--color-ivory)] hover:z-10 hover:shadow-2xl'} relative overflow-visible group transition-all duration-700 w-full outline-none border hover:border-[var(--color-antique-gold)] hover:border-opacity-30 ${isSelected ? 'border-[var(--color-antique-gold)] border-opacity-50' : 'border-transparent'}`}
      >
        <div className={`absolute top-4 left-4 w-4 h-4 border-t border-l border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute top-4 right-4 w-4 h-4 border-t border-r border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute bottom-4 left-4 w-4 h-4 border-b border-l border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute bottom-4 right-4 w-4 h-4 border-b border-r border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        
        <span className={`font-serif text-[1.1rem] tracking-[0.15em] mb-6 z-10 transition-colors duration-500 uppercase text-[var(--color-muted)]`}>
          {title}
        </span>
        <div className="flex flex-col items-center z-10 mb-4 outline-none relative">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span 
               key={value}
               initial={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
               animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
               exit={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
               transition={{ duration: 0.5, type: 'spring', bounce: 0 }}
               className={`font-serif text-6xl md:text-7xl leading-none transition-colors duration-700 ${isSelected ? 'text-[var(--color-antique-gold)] drop-shadow-sm' : 'text-[var(--color-ink)]'}`}
             >
               {value}
            </motion.span>
          </AnimatePresence>
          <div className="h-6 mt-4 flex items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              {composite !== value.toString() ? (
                <motion.span 
                  key={composite}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`font-sans text-[0.65rem] tracking-[0.25em] uppercase transition-colors duration-500 ${isSelected ? 'text-[var(--color-antique-gold)] opacity-80' : 'text-[var(--color-muted)]'}`}
                >
                  {composite}
                </motion.span>
              ) : (
                <motion.span 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-sans text-[0.65rem] opacity-0 select-none tracking-[0.2em] uppercase"
                >
                  —
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[var(--color-muted)] mb-2 opacity-80">{numInfo?.planet || 'Нет планеты'}</span>
        <span className="font-serif text-sm italic text-[var(--color-graphite)] line-clamp-1 mb-4">{numInfo?.luxuryName || ''}</span>
        <p className="font-sans text-[10px] md:text-[11px] text-center leading-relaxed text-[var(--color-muted)] max-w-[200px] mt-auto opacity-70">
          {numInfo?.core}
        </p>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-ivory)] bg-marble min-h-screen text-[var(--color-ink)] font-sans overflow-x-hidden">
      
      <QuoteOfTheDay />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16 pt-10"
      >
        <h1 className="font-serif text-5xl md:text-7xl tracking-widest uppercase mb-6 text-[var(--color-ink)] drop-shadow-sm">
          Архитектура<br className="md:hidden" /> Кода
        </h1>
        <p className="font-sans text-xs md:text-sm tracking-[0.4em] uppercase text-[var(--color-antique-gold)] opacity-90 mb-4">
          Познай самого себя
        </p>
        <MeanderDivider />
        <div className="relative inline-block mt-4">
          <div className="absolute -left-8 -top-8 w-16 h-16 bg-[var(--color-antique-gold)] opacity-5 blur-2xl rounded-full"></div>
          <p className="font-serif text-[1.1rem] md:text-xl text-[var(--color-muted)] max-w-md mx-auto italic leading-relaxed relative z-0">
            Введите дату рождения — система покажет первый слой вашей внутренней архитектуры.
          </p>
        </div>
      </motion.div>

      {/* Input Form */}
      <motion.form 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        onSubmit={handleCalculate} 
        className="w-full max-w-lg flex flex-col items-center mb-16"
      >
        <div className="w-full space-y-4">
          <div className="relative w-full flex items-center group bg-white/40 backdrop-blur-md rounded-lg shadow-sm border border-[var(--border-soft)] hover:shadow-md transition-shadow">
            <DatePicker
              selected={selectedDate}
              onChangeRaw={(e) => {
                const target = e.target as HTMLInputElement;
                if (!target) return;
                const prev = target.value;
                let val = prev.replace(/[^\d]/g, '');
                if (val.length > 2) val = val.substring(0, 2) + '.' + val.substring(2);
                if (val.length > 5) val = val.substring(0, 5) + '.' + val.substring(5, 9);
                if (val !== prev) {
                   const selStart = target.selectionStart;
                   target.value = val;
                   setDate(val);
                   if (selStart && selStart <= val.length) {
                       target.setSelectionRange(selStart + (val.length > prev.length && (val.endsWith('.') || val.charAt(selStart - 1) === '.') ? 1 : 0), selStart + (val.length > prev.length && (val.endsWith('.') || val.charAt(selStart - 1) === '.') ? 1 : 0));
                   }
                } else {
                   setDate(val);
                }
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
              className="w-full bg-transparent text-center font-serif text-2xl md:text-3xl py-6 outline-none transition-colors placeholder:text-[var(--color-muted)]/50 text-[var(--color-ink)] px-16"
              wrapperClassName="w-full"
            />
            <AnimatePresence>
              {(date.length > 0 || selectedDate) && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => {
                    setSelectedDate(null);
                    setDate('');
                  }}
                  className="absolute left-4 p-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors opacity-60 hover:opacity-100 focus:outline-none"
                  title="Очистить"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
            <button 
              type="submit" 
              disabled={isGenerating || date.length !== 10 || !consentChecked}
              className="absolute right-3 p-4 bg-transparent text-[var(--color-ink)]/70 hover:text-[var(--color-antique-gold)] transition-all disabled:opacity-30 disabled:hover:text-[var(--color-ink)]/70"
            >
              {isGenerating ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ArrowRight className="w-6 h-6" strokeWidth={1.5} />
              )}
            </button>
          </div>
          
          <div className="pt-2 flex items-center justify-center gap-3 w-full">
            <input 
              type="checkbox" 
              id="consent" 
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-antique-gold)] cursor-pointer"
            />
            <label htmlFor="consent" className="text-xs text-[var(--color-muted)] cursor-pointer select-none">
              Я согласен с <a href="/privacy.html" target="_blank" className="underline hover:text-[var(--color-antique-gold)]">Политикой обработки персональных данных</a>
            </label>
          </div>
        </div>
      </motion.form>

      {/* Error Display */}
      <AnimatePresence mode="wait">
        {errorInfo && (
           <motion.div 
             initial={{ opacity: 0, y: -10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="mb-10 max-w-md text-center text-red-900 bg-red-50/50 p-4 font-sans text-sm border border-red-100"
           >
             {errorInfo.message}
           </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div 
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-lg flex flex-col items-center justify-center py-32 mx-auto"
          >
            <div className="relative w-48 h-48 flex items-center justify-center mb-10">
               {/* Outer Ring */}
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-0 border-[1px] border-[var(--color-antique-gold)] rounded-full border-dashed opacity-50"
               />
               {/* Middle Ring */}
               <motion.div 
                 animate={{ rotate: -360 }}
                 transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-4 border-[1px] border-[var(--color-ink)] rounded-full opacity-20"
               />
               {/* Inner Geometry */}
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-10 flex items-center justify-center p-2"
               >
                  <div className="w-full h-full border-[1px] border-[var(--color-antique-gold)] rounded-sm rotate-45 opacity-70"></div>
                  <div className="absolute w-full h-full border-[1px] border-[var(--color-antique-gold)] rounded-sm opacity-70"></div>
               </motion.div>
               {/* Center Dot */}
               <div className="w-3 h-3 bg-[var(--color-antique-gold)] rounded-full animate-pulse shadow-[0_0_15px_var(--color-antique-gold)]"></div>
            </div>
            <p className="font-serif italic text-xl text-[var(--color-ink)] tracking-wide mb-2 animate-pulse">Считываем архитектуру...</p>
            <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--color-muted)] opacity-60">Подготовка зеркал</p>
          </motion.div>
        ) : result && (
          <motion.div 
            key="results"
            layout
            id="code-architecture-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl flex flex-col items-center"
          >
            <div className="flex flex-col items-center gap-3 mb-10 w-full text-center">
              <h2 className="font-serif text-3xl text-[var(--color-ink)] mb-1">Архитектура Кода</h2>
              <MeanderDivider />
            </div>

            {/* 5 Main Numbers Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] w-full ${selectedMainNumber ? 'mb-2' : 'mb-16'} transition-all duration-500`}>
              <NumberCard title="Душа" pos="soul" value={result.soul} composite={result.soulComposite} delay={0.1} />
              <NumberCard title="Путь" pos="path" value={result.path} composite={result.pathComposite} delay={0.2} />
              <NumberCard title="Направление" pos="direction" value={result.direction} composite={result.directionComposite} delay={0.3} />
              <NumberCard title="Выражение" pos="expression" value={result.expression} composite={result.expressionComposite} delay={0.4} />
               <div className="sm:col-span-2 md:col-span-1">
                 <NumberCard title="Результат" pos="result" value={result.result} composite={result.resultComposite} delay={0.5} />
               </div>
            </div>

            {/* Main Number Detail Modal/Section */}
            <AnimatePresence>
              {selectedMainNumber && (() => {
                const numVal = selectedMainNumber.value;
                const numKey = numVal === 11 ? 11 : (numVal > 9 ? numVal % 9 || 9 : numVal);
                const knowledge = numberKnowledge[numKey] || numberKnowledge[1];
                const pt = selectedMainNumber.pos as keyof typeof knowledge.positions;
                const posData = knowledge.positions[pt] || { title: "", essence: "", strength: "", tension: "", recommendation: "" };
                
                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="w-full overflow-hidden mb-16"
                  >
                    <div className="p-8 md:p-12 bg-white/60 backdrop-blur-sm border border-[var(--border-soft)] shadow-[var(--shadow-luxury)] relative overflow-hidden rounded-sm">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-60"></div>
                      <div className="absolute -left-20 -top-20 w-64 h-64 bg-[var(--color-antique-gold)] opacity-5 blur-[100px] pointer-events-none"></div>
                      <div className="flex justify-between items-start mb-10 relative z-10">
                        <div>
                           <h3 className="font-serif text-4xl md:text-5xl text-[var(--color-ink)] tracking-wide">{posData.title}</h3>
                           <p className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] mt-3 font-medium">
                             {knowledge.archetypeName} <span className="mx-2 opacity-50">•</span> Планета: {knowledge.planet}
                           </p>
                           {knowledge.tale && (
                             <button
                               onClick={() => setTaleModal(knowledge.tale!)}
                               className="mt-6 font-sans text-[0.65rem] uppercase tracking-widest text-[var(--color-antique-gold)] flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-antique-gold)] hover:bg-[var(--color-antique-gold)] hover:text-[var(--color-ivory)] transition-colors rounded-sm"
                             >
                               <BookOpen className="w-4 h-4" />
                               Открыть сказку числа
                             </button>
                           )}
                        </div>
                        <button 
                          onClick={() => setSelectedMainNumber(null)}
                          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] bg-white/50 hover:bg-white rounded-full transition-all p-3 shadow-sm border border-transparent hover:border-[var(--border-soft)]"
                        >
                          <X className="w-6 h-6" strokeWidth={1} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                         <div className="md:col-span-2 space-y-8">
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5, delay: 0.1 }}
                            >
                               <p className="font-serif text-[1.15rem] leading-relaxed text-[var(--color-graphite)] italic border-l-2 border-[var(--color-antique-gold)] pl-4">
                                 "{posData.essence}"
                               </p>
                            </motion.div>

                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                              className="grid grid-cols-1 md:grid-cols-2 gap-6"
                            >
                              <div className="bg-white/50 p-6 border border-white/60 shadow-sm rounded-sm">
                                 <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-antique-gold)] mb-3">Дар</h4>
                                 <p className="font-serif text-[0.95rem] leading-relaxed text-[var(--color-ink)]">{knowledge.gift}</p>
                              </div>
                              <div className="bg-white/50 p-6 border border-white/60 shadow-sm rounded-sm">
                                 <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-3">Тень</h4>
                                 <p className="font-serif text-[0.95rem] leading-relaxed text-[var(--color-ink)]">{knowledge.shadow}</p>
                              </div>
                            </motion.div>

                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5, delay: 0.3 }}
                              className="space-y-6"
                            >
                              <div>
                                 <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-2">Главная задача</h4>
                                 <p className="font-serif text-[1.05rem] leading-relaxed text-[var(--color-graphite)]">{knowledge.task}</p>
                              </div>

                              <div className="bg-[var(--color-ivory)] p-6 border border-[var(--border-soft)] rounded-sm">
                                 <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-3">Практический ключ</h4>
                                 <p className="font-serif text-[1.05rem] leading-relaxed text-[var(--color-ink)]">{knowledge.practicalKey}</p>
                              </div>
                              <AssociativeCloud keywords={knowledge.keywords} />
                            </motion.div>
                         </div>
                         
                         <motion.div 
                           initial={{ opacity: 0, x: 10 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ duration: 0.5, delay: 0.4 }}
                           className="bg-[var(--color-marble)] p-8 border border-[var(--border-soft)] flex flex-col h-full rounded-sm"
                         >
                            <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-4">Ядро энергии</h4>
                            <p className="font-serif text-[1.05rem] leading-relaxed text-[var(--color-graphite)] mb-8">{knowledge.core}</p>
                            
                            <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-4">Детали позиции</h4>
                            <div className="space-y-5 flex-1">
                               <div>
                                  <h5 className="font-sans text-[0.6rem] tracking-[0.1em] uppercase text-[var(--color-muted)] mb-2">Сила</h5>
                                  <p className="font-serif text-[0.95rem] leading-relaxed text-[var(--color-ink)]">{posData.strength}</p>
                               </div>
                               <div>
                                  <h5 className="font-sans text-[0.6rem] tracking-[0.1em] uppercase text-[var(--color-muted)] mb-2">Напряжение</h5>
                                  <p className="font-serif text-[0.95rem] leading-relaxed text-[var(--color-ink)]">{posData.tension}</p>
                               </div>
                               {posData.recommendation && (
                                 <div>
                                    <h5 className="font-sans text-[0.6rem] tracking-[0.1em] uppercase text-[var(--color-antique-gold)] mb-2">Наблюдение</h5>
                                    <p className="font-serif text-[0.95rem] leading-relaxed text-[var(--color-ink)] italic">{posData.recommendation}</p>
                                 </div>
                               )}
                            </div>
                         </motion.div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Matrix Section */}
            <motion.div 
              layout
              ref={matrixRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="w-full flex flex-col items-center mb-16"
            >
              <div className="flex flex-col items-center">
                <div className="flex gap-8 mb-10">
                  <button 
                    type="button"
                    onClick={() => setMatrixType('base')}
                    className={`font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 pb-2 outline-none ${matrixType === 'base' ? 'text-[var(--color-ink)] border-b border-[var(--color-antique-gold)] opacity-100' : 'text-[var(--color-muted)] border-b border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    Базовая
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMatrixType('detailed')}
                    className={`font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 pb-2 outline-none ${matrixType === 'detailed' ? 'text-[var(--color-ink)] border-b border-[var(--color-antique-gold)] opacity-100' : 'text-[var(--color-muted)] border-b border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    Детальная
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] shadow-sm bg-[var(--color-surface)]">
                  {(() => {
                    const activeMatrix = matrixType === 'base' ? result.baseMatrix : result.detailedMatrix;
                    
                    const getCount = (digits: string) => digits.split('').reduce((acc, d) => acc + (activeMatrix[d] || 0), 0);
                    const r1 = getCount('147');
                    const r2 = getCount('258');
                    const r3 = getCount('369');
                    const c1 = getCount('123');
                    const c2 = getCount('456');
                    const c3 = getCount('789');
                    const d1 = getCount('159');
                    const d2 = getCount('357');

                    const MatrixCell = ({ num, index }: { num: string, index: number }) => {
                      const count = activeMatrix[num] || 0;
                      const hoverLine = hoveredLines.find(line => NUM_LINES[num].includes(line));
                      const isHovered = !!hoverLine;
                      const isSelected = selectedCell === num;
                      const cellMeaning = MATRIX_CELL_MEANS[num] || `Качество ${num}`;
                      
                      let bgColor = "bg-[var(--color-surface)] bg-marble";
                      let textColor = "text-[var(--color-ink)]";
                      let content = (
                        <motion.span 
                          key="empty" 
                          initial={{ opacity: 0, scale: 0.5 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          exit={{ opacity: 0, scale: 0.5 }} 
                          className="font-sans text-sm text-[var(--color-border)] opacity-60"
                        >
                          —
                        </motion.span>
                      );

                      if (count > 0) {
                        content = (
                          <motion.span 
                            key={count} 
                            initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }} 
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} 
                            exit={{ opacity: 0, scale: 1.5, filter: 'blur(4px)' }} 
                            transition={{ duration: 0.4, type: 'spring', bounce: 0 }}
                            className={`font-serif text-2xl sm:text-3xl ${count >= 3 ? 'font-medium' : ''}`}
                          >
                            {num.repeat(count)}
                          </motion.span>
                        );
                      }

                      if (isSelected) {
                        bgColor = "bg-[var(--color-ivory)] bg-marble z-20 relative opacity-100 shadow-[var(--shadow-luxury)] border-none ring-1 ring-[var(--color-antique-gold)]";
                        if (count >= 3) textColor = "text-[var(--color-antique-gold)] drop-shadow-sm";
                      } else if (isHovered && hoverLine) {
                        bgColor = count > 0 ? LINE_STYLES['r'].bg : LINE_STYLES['r'].bgEmpty;
                        textColor = LINE_STYLES['r'].text;
                      } else if (count > 0) {
                        bgColor = count >= 3 ? "bg-[var(--color-ivory)] bg-marble border-none" : "bg-[var(--color-surface)] bg-marble border-none";
                        if (count >= 3) textColor = "text-[var(--color-antique-gold)] drop-shadow-sm";
                      }

                          const linesInfo = NUM_LINES[num]?.map(lineId => {
                            const lineName = MATRIX_LINE_MEANS[lineId] || lineId;
                            let lineSum = 0;
                            if (lineId === 'r1') lineSum = r1; else if (lineId === 'r2') lineSum = r2; else if (lineId === 'r3') lineSum = r3;
                            else if (lineId === 'c1') lineSum = c1; else if (lineId === 'c2') lineSum = c2; else if (lineId === 'c3') lineSum = c3;
                            else if (lineId === 'd1') lineSum = d1; else if (lineId === 'd2') lineSum = d2;
                            return `• Линия «${lineName}»: ${lineSum} цифр`;
                          }).join('\n') || '';

                          const cellTitle = `${cellMeaning}: ${count} цифр\n\nВходит в линии:\n${linesInfo}`;

                          return (
                            <motion.button
                              key={`${matrixType}-${num}`}
                              title={cellTitle}
                              onClick={() => setSelectedCell(selectedCell === num ? null : num)}
                          onMouseEnter={() => setHoveredLines(NUM_LINES[num])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: isSelected ? 1.05 : 1 }}
                          whileHover={{ scale: isSelected ? 1.05 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.4, delay: (isSelected || isHovered) ? 0 : index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center outline-none transition-colors duration-500 cursor-pointer ${bgColor} ${textColor} ${isSelected ? 'z-20' : 'hover:z-10 box-border'} relative overflow-hidden`}
                        >
                          <AnimatePresence mode="popLayout" initial={false}>
                            {content}
                          </AnimatePresence>
                        </motion.button>
                      );
                    };

                    const LineSum = ({ label, value, index, lineId }: { label: string, value: number, index: number, lineId: string }) => {
                      const isHovered = hoveredLines.includes(lineId) || (!!selectedCell && NUM_LINES[selectedCell]?.includes(lineId));
                      const lineMeaning = MATRIX_LINE_MEANS[lineId] || label;
                      
                      return (
                        <motion.div
                          key={`${matrixType}-${label}`}
                          title={`Линия «${lineMeaning}»: сумма ${value} цифр`}
                          onMouseEnter={() => setHoveredLines([lineId])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: isHovered ? 1.02 : 1 }}
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.4, delay: isHovered ? 0 : index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center transition-colors duration-500 cursor-default ${isHovered ? LINE_STYLES['r'].bg + ' z-20 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]/40' : 'bg-[var(--color-surface)] bg-marble border-none shadow-sm'} relative overflow-hidden`}
                        >
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span 
                              key={value}
                              initial={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
                              transition={{ duration: 0.4 }}
                              className={`font-serif text-lg transition-colors duration-300 ${(isHovered) ? LINE_STYLES['r'].text : (value >= 5 ? 'text-[var(--color-antique-gold)]' : 'text-[var(--color-muted)]')}`}
                            >
                              {value}
                            </motion.span>
                          </AnimatePresence>
                          <span className={`text-[0.45rem] sm:text-[0.55rem] tracking-widest uppercase mt-1 transition-colors duration-300 ${isHovered ? LINE_STYLES['r'].text : 'text-[var(--color-muted)] opacity-60'}`}>{label}</span>
                        </motion.div>
                      );
                    };

                    const isD1Active = hoveredLines.includes('d1') || (!!selectedCell && NUM_LINES[selectedCell]?.includes('d1'));
                    const isD2Active = hoveredLines.includes('d2') || (!!selectedCell && NUM_LINES[selectedCell]?.includes('d2'));
                    const isAnyDActive = isD1Active || isD2Active;

                    return (
                      <>
                        {/* ROW 1 */}
                        <MatrixCell num="1" index={0} />
                        <MatrixCell num="4" index={1} />
                        <MatrixCell num="7" index={2} />
                        <LineSum label="Цель" value={r1} index={3} lineId="r1" />

                        {/* ROW 2 */}
                        <MatrixCell num="2" index={4} />
                        <MatrixCell num="5" index={5} />
                        <MatrixCell num="8" index={6} />
                        <LineSum label="Семья" value={r2} index={7} lineId="r2" />

                        {/* ROW 3 */}
                        <MatrixCell num="3" index={8} />
                        <MatrixCell num="6" index={9} />
                        <MatrixCell num="9" index={10} />
                        <LineSum label="Привычка" value={r3} index={11} lineId="r3" />

                        {/* ROW 4 */}
                        <LineSum label="Я" value={c1} index={12} lineId="c1" />
                        <LineSum label="Вектор" value={c2} index={13} lineId="c2" />
                        <LineSum label="Талант" value={c3} index={14} lineId="c3" />
                        
                        {/* DIAGONALS */}
                        <motion.div 
                          key={`${matrixType}-diagonals`}
                          onMouseEnter={() => setHoveredLines(['d1', 'd2'])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: isAnyDActive ? 1.02 : 1 }}
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.4, delay: isAnyDActive ? 0 : 15 * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center transition-colors duration-500 cursor-default ${isAnyDActive ? LINE_STYLES['d'].bg + ' z-20 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]/40' : 'bg-[var(--color-surface)] bg-marble border-none shadow-sm'} relative overflow-hidden`}
                        >
                          <div className="flex gap-2 sm:gap-3 mb-1 overflow-hidden">
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span 
                                key={d1}
                                initial={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
                                transition={{ duration: 0.4 }}
                                className={`text-xs sm:text-[0.95rem] font-serif transition-colors duration-500 ${isD1Active ? LINE_STYLES['d'].text : 'text-[var(--color-ink)]'}`} 
                                title={`Внутренний компас (1-5-9): ${d1}`}
                              >
                                {d1}
                              </motion.span>
                            </AnimatePresence>
                            <span className="text-[var(--border-soft)]">/</span>
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span 
                                key={d2}
                                initial={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
                                transition={{ duration: 0.4 }}
                                className={`text-xs sm:text-[0.95rem] font-serif transition-colors duration-500 ${isD2Active ? LINE_STYLES['d'].text : 'text-[var(--color-antique-gold)]'}`} 
                                title={`Темперамент (3-5-7): ${d2}`}
                              >
                                {d2}
                              </motion.span>
                            </AnimatePresence>
                          </div>
                          <span className={`text-[0.4rem] sm:text-[0.45rem] tracking-widest uppercase mt-1 text-center leading-[1.3] transition-colors duration-500 ${isAnyDActive ? LINE_STYLES['d'].text : 'text-[var(--color-muted)] opacity-50'}`}>ВНУТР.<br/>ТЕМП.</span>
                        </motion.div>
                      </>
                    );
                  })()}
                </div>
                
                <AnimatePresence>
                   {selectedCell && (
                     <motion.div
                       initial={{ opacity: 0, height: 0, marginTop: 0 }}
                       animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                       exit={{ opacity: 0, height: 0, marginTop: 0 }}
                       className="w-full bg-kraft border border-[var(--color-antique-gold)] border-opacity-30 p-6 shadow-[0_10px_40px_rgba(30,25,18,0.08)] overflow-hidden rounded-sm relative"
                     >
                        <h4 className="font-serif text-xl tracking-wider uppercase text-[var(--color-ink)] mb-2">
                          {MATRIX_CELL_MEANS[selectedCell]}
                        </h4>
                        <div className="h-px w-12 bg-[var(--color-antique-gold)] mb-4 opacity-50"></div>
                        <div className="flex flex-col gap-3">
                           {NUM_LINES[selectedCell]?.map(lineId => {
                              const lineName = MATRIX_LINE_MEANS[lineId] || lineId;
                              const activeMatrix = matrixType === 'base' ? result.baseMatrix : result.detailedMatrix;
                              const getCount = (digits: string) => digits.split('').reduce((acc, d) => acc + (activeMatrix[d] || 0), 0);
                              let lineSum = 0;
                              if (lineId === 'r1') lineSum = getCount('147');
                              else if (lineId === 'r2') lineSum = getCount('258');
                              else if (lineId === 'r3') lineSum = getCount('369');
                              else if (lineId === 'c1') lineSum = getCount('123');
                              else if (lineId === 'c2') lineSum = getCount('456');
                              else if (lineId === 'c3') lineSum = getCount('789');
                              else if (lineId === 'd1') lineSum = getCount('159');
                              else if (lineId === 'd2') lineSum = getCount('357');
                              
                              return (
                                <div key={lineId} className="flex justify-between items-center text-sm font-sans border-b border-[var(--border-soft)] pb-2 last:border-0 last:pb-0">
                                   <span className="text-[var(--color-muted)] uppercase tracking-widest text-[0.65rem] sm:text-xs">Линия «{lineName}»</span>
                                   <span className="font-serif text-[var(--color-antique-gold)] text-lg">{lineSum}</span>
                                </div>
                              );
                           })}
                         </div>
                      </motion.div>
                    )}
                 </AnimatePresence>

                 {/* Distribution Chart */}
                 <div className="w-full mt-24 flex flex-col items-center bg-[var(--color-surface)] bg-marble py-10 px-4 md:px-8 shadow-sm">
                   <h3 className="font-serif text-lg tracking-[0.15em] uppercase text-[var(--color-ink)] mb-4 text-center">
                     Распределение Элементов
                   </h3>
                   <div className="h-px w-12 bg-[var(--color-antique-gold)] mb-8 opacity-50"></div>
                   <div className="w-full max-w-xs h-64 relative focus:outline-none">
                     {(() => {
                       const activeMatrixForPie = matrixType === 'base' ? result.baseMatrix : result.detailedMatrix;
                       const pieData = Object.entries(activeMatrixForPie)
                         .filter(([num, count]) => num !== '0' && count > 0)
                         .map(([num, count]) => ({
                           name: MATRIX_CELL_MEANS[num] || `Энергия ${num}`,
                           value: count,
                           num
                         }))
                         .sort((a, b) => b.value - a.value);

                       const CHART_COLORS = [
                         '#d4af37', // antique gold
                         '#2a2a2a', // ink
                         '#8c7d60', // dark gold
                         '#6b6b6b', // graphite light
                         '#b8a67c', // soft gold
                         '#4a4a4a', // graphite
                         '#e2d5ba', // ivory gold
                         '#8b8476', // muted
                         '#1a1918'  // deep dark
                       ];

                       if (pieData.length === 0) return null;

                       return (
                         <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie
                               data={pieData}
                               cx="50%"
                               cy="50%"
                               innerRadius={65}
                               outerRadius={95}
                               paddingAngle={2}
                               dataKey="value"
                               stroke="var(--color-surface)"
                               strokeWidth={2}
                               animationDuration={1500}
                               animationEasing="ease-out"
                               style={{ outline: "none" }}
                             >
                               {pieData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} style={{ outline: "none" }} />
                               ))}
                             </Pie>
                             <Tooltip 
                               contentStyle={{ 
                                 backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                 border: '1px solid var(--color-antique-gold)',
                                 borderRadius: '2px',
                                 fontFamily: 'var(--font-sans)',
                                 fontSize: '0.75rem',
                                 textTransform: 'uppercase',
                                 letterSpacing: '0.1em',
                                 boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                               }}
                               itemStyle={{ color: 'var(--color-ink)', fontWeight: 500 }}
                               formatter={(value: number) => [`${value} цифр`, 'Количество']}
                             />
                           </PieChart>
                         </ResponsiveContainer>
                       );
                     })()}
                   </div>
                   <p className="font-sans text-[0.65rem] tracking-[0.1em] text-[var(--color-muted)] uppercase mt-6 opacity-70 text-center max-w-xs leading-relaxed">
                     Соотношение энергий в {matrixType === 'base' ? 'базовой' : 'детальной'} матрице
                   </p>
                 </div>
              </div>
            </motion.div>

            {/* First Mirror */}
            <div className="w-full flex flex-col items-center mb-12">
              {reading ? (
                <>
                  <FirstMirrorPanel data={reading} onCtaClick={() => handlePdfRequest('code_first_mirror')} />
                  {demoNotice && (
                    <p className="text-center font-sans text-[0.7rem] tracking-[0.1em] text-[var(--color-muted)] uppercase mb-12 opacity-80">
                      {demoNotice}
                    </p>
                  )}
                  <BigResearchTeaser onCtaClick={() => handlePdfRequest('code_big_research')} />
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="mt-16 mb-8 w-full flex flex-col md:flex-row justify-center items-center gap-6"
                  >
                     <button
                        onClick={() => handlePdfRequest('code_full_research')}
                        className="px-10 py-5 bg-[var(--color-ink)] text-[var(--color-ivory)] hover:bg-[var(--color-antique-gold)] hover:text-white transition-all duration-500 font-sans tracking-[0.2em] uppercase text-sm border border-transparent hover:shadow-[0_0_40px_rgba(212,175,55,0.4)]"
                     >
                       Получить полную версию
                     </button>
                     
                     <button
                        onClick={() => saveElementAsPdf(document.getElementById('code-architecture-results'), 'DigitalCode_Architecture.pdf')}
                        className="px-10 py-5 bg-transparent border border-[var(--color-antique-gold)] border-opacity-40 text-[var(--color-ink)] hover:bg-[var(--color-antique-gold)] hover:text-white transition-all duration-500 font-sans tracking-[0.2em] uppercase text-sm flex items-center justify-center gap-3 hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                     >
                       <Download className="w-4 h-4" />
                       Сохранить разбор
                     </button>
                  </motion.div>
                </>
              ) : null}
            </div>

            {/* Content wrapper closes usually... wait, I need to place it before the final div closes. */}
      {/* Tale Modal */}
      <AnimatePresence>
        {taleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTaleModal(null)}
              className="absolute inset-0 bg-[var(--color-ink)]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[var(--color-ivory)] bg-marble p-8 md:p-12 max-w-2xl w-full shadow-2xl z-10 border border-[var(--color-antique-gold)]/20 rounded-sm"
            >
              <button
                onClick={() => setTaleModal(null)}
                className="absolute top-4 right-4 p-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                title="Закрыть"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex flex-col items-center mb-8">
                <BookOpen className="w-8 h-8 text-[var(--color-antique-gold)] mb-6 opacity-80" />
                <h2 className="font-serif text-3xl md:text-4xl text-center text-[var(--color-ink)]">{taleModal.title}</h2>
              </div>
              <div className="prose prose-stone max-w-none">
                <p className="font-serif text-[1.15rem] leading-relaxed text-[var(--color-graphite)] whitespace-pre-wrap text-center md:text-left indent-0 md:indent-8">
                  {taleModal.text}
                </p>
              </div>
              <div className="mt-12 flex justify-center">
                 <button
                   onClick={() => setTaleModal(null)}
                   className="px-8 py-3 bg-[var(--color-surface)] border border-[var(--border-soft)] hover:border-[var(--color-antique-gold)] text-[var(--color-ink)] transition-colors text-sm tracking-widest uppercase font-sans outline-none"
                 >
                   Вернуться
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LeadModal 
              isOpen={showLeadModal} 
              onClose={() => setShowLeadModal(false)} 
              source={leadSource} 
              defaultBirthDate={date} 
              theme="light" 
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
