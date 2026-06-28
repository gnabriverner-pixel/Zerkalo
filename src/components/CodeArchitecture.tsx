import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Info, ArrowRight, Loader2, X } from 'lucide-react';
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
  
  const [showLeadModal, setShowLeadModal] = useState(false);
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

  const handlePdfRequest = () => {
    const cleanDate = date.replace(/\./g, '');
    const dateQuery = cleanDate.length === 8 ? `?start=dob_${cleanDate}` : '';
    window.open(`https://t.me/digitalcodesystem_bot${dateQuery}`, '_blank', 'noopener,noreferrer');
  };

      const NumberCard = ({ title, pos, value, composite, delay }: { title: string, pos: string, value: number, composite: string, delay: number }) => {
    const isSelected = selectedMainNumber?.title === title;
    const numKey = value === 11 ? 11 : (value > 9 ? value % 9 || 9 : value); // handle higher numbers if happen
    const numInfo = numberKnowledge[numKey] || numberKnowledge[1];
    
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, scale: isSelected ? 1.02 : 1 }}
        transition={{ duration: 0.8, delay: (isSelected) ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
        className={`flex flex-col items-center p-8 md:p-10 bg-[var(--color-surface)] bg-marble ${isSelected ? 'bg-gradient-to-br from-[var(--color-ivory)] to-[#f2eee3] z-10 shadow-[0_40px_100px_rgba(30,25,18,0.18)]' : 'hover:bg-[var(--color-ivory)] hover:z-10 hover:shadow-2xl'} relative overflow-visible group transition-all duration-700 w-full outline-none border hover:border-[var(--color-antique-gold)] hover:border-opacity-30 ${isSelected ? 'border-[var(--color-antique-gold)] border-opacity-50' : 'border-transparent'}`}
      >
        <div className={`absolute top-4 left-4 w-4 h-4 border-t border-l border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute top-4 right-4 w-4 h-4 border-t border-r border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute bottom-4 left-4 w-4 h-4 border-b border-l border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute bottom-4 right-4 w-4 h-4 border-b border-r border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        
        {/* Helper Tooltip Icon */}
        <div 
          className="absolute top-5 right-5 z-20"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Info className="w-4 h-4 text-[var(--color-muted)] opacity-50 relative top-2 right-2 hover:opacity-100 hover:text-[var(--color-antique-gold)] cursor-help transition-colors" />
          <AnimatePresence>
            {showTooltip && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute right-0 top-6 w-56 bg-white/95 backdrop-blur-md text-[var(--color-ink)] p-4 shadow-2xl z-50 pointer-events-none rounded-sm border border-[var(--border-soft)]"
              >
                <p className="font-serif italic text-sm text-[var(--color-antique-gold)] mb-2 tracking-wide">{numInfo?.luxuryName}</p>
                <p className="font-sans text-xs leading-relaxed text-[var(--color-graphite)] shadow-sm">{numInfo?.core}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <span className={`font-serif text-[1.1rem] tracking-[0.15em] mb-6 z-10 transition-colors duration-500 uppercase text-[var(--color-muted)]`}>
          {title}
        </span>
        <button type="button" onClick={() => setSelectedMainNumber(isSelected ? null : {title, value, pos})} className="flex flex-col items-center z-10 mb-4 cursor-pointer outline-none">
          <span className={`font-serif text-6xl md:text-7xl leading-none transition-colors duration-700 ${isSelected ? 'text-[var(--color-antique-gold)] drop-shadow-sm' : 'text-[var(--color-ink)]'}`}>
            {value}
          </span>
          {composite !== value.toString() ? (
            <span className={`font-sans text-[0.65rem] mt-4 tracking-[0.25em] uppercase transition-colors duration-500 ${isSelected ? 'text-[var(--color-antique-gold)] opacity-80' : 'text-[var(--color-muted)]'}`}>
              {composite}
            </span>
          ) : (
            <span className="font-sans text-[0.65rem] mt-4 opacity-0 select-none tracking-[0.2em] uppercase">—</span>
          )}
        </button>
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[var(--color-muted)] mb-2 opacity-80">{numInfo?.planet || 'Нет планеты'}</span>
        <span className="font-serif text-sm italic text-[var(--color-graphite)] line-clamp-1">{numInfo?.luxuryName || ''}</span>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 w-full text-[var(--color-ink)] font-sans">
      
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
          <p className="font-serif text-[1.1rem] md:text-xl text-[var(--color-muted)] max-w-md mx-auto italic leading-relaxed relative z-10">
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
              popperContainer={({ children }) => createPortal(children, document.body)}
            />
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
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl flex flex-col items-center"
          >
            <div className="flex flex-col items-center gap-3 mb-10 w-full text-center">
              <div className="h-10 w-64 bg-[var(--color-marble)] animate-pulse rounded-full mb-1"></div>
              <MeanderDivider />
            </div>

            {/* Skeleton Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] w-full mb-16 shadow-lg`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`flex flex-col items-center p-8 bg-[var(--color-surface)] ${i === 5 ? 'sm:col-span-2 md:col-span-1' : ''} bg-marble relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--color-ivory)] to-transparent opacity-30 animate-pulse"></div>
                  <div className="h-3 w-16 bg-[var(--color-antique-gold)]/20 rounded-full animate-pulse mb-6"></div>
                  <div className="h-14 w-12 bg-[var(--color-ink)]/10 rounded-md animate-pulse mb-4"></div>
                  <div className="h-2 w-10 bg-[var(--color-muted)]/20 rounded-full animate-pulse mb-8"></div>
                  <div className="h-[2px] w-20 bg-[var(--color-border)]/20 animate-pulse"></div>
                </div>
              ))}
            </div>

            {/* Skeleton Matrix */}
            <div className="w-full flex flex-col items-center mb-16">
               <div className="h-6 w-48 bg-[var(--color-marble)] animate-pulse mb-10"></div>
               <div className="grid grid-cols-4 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] shadow-sm">
                 {Array.from({ length: 16 }).map((_, i) => (
                   <div key={i} className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-surface)] animate-pulse"></div>
                 ))}
               </div>
            </div>

            {/* Skeleton First Mirror Panel */}
            <div className="w-full flex flex-col items-center mb-12">
               <div className="w-full h-96 bg-[var(--color-surface)] border border-[var(--border-soft)] p-8 animate-pulse">
                  <div className="flex justify-between w-full h-12 mb-8">
                     <div className="h-8 w-48 bg-[var(--color-marble)]"></div>
                     <div className="h-6 w-32 bg-[var(--color-marble)]"></div>
                  </div>
                  <div className="h-4 w-full bg-[var(--color-marble)] mb-4"></div>
                  <div className="h-4 w-5/6 bg-[var(--color-marble)] mb-4"></div>
                  <div className="h-4 w-4/6 bg-[var(--color-marble)] mb-8"></div>
                  
                  <div className="grid grid-cols-2 gap-8 pt-8">
                     <div className="h-24 w-full bg-[var(--color-marble)]"></div>
                     <div className="h-24 w-full bg-[var(--color-marble)]"></div>
                  </div>
               </div>
            </div>
          </motion.div>
        ) : result && (
          <motion.div 
            key="results"
            layout
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
                      <div className="flex justify-between items-start mb-10">
                        <div>
                           <h3 className="font-serif text-4xl md:text-5xl text-[var(--color-ink)] tracking-wide">{posData.title}</h3>
                           <p className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] mt-3 font-medium">{knowledge.archetypeName}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedMainNumber(null)}
                          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] bg-white/50 hover:bg-white rounded-full transition-all p-3 shadow-sm border border-transparent hover:border-[var(--border-soft)]"
                        >
                          <X className="w-6 h-6" strokeWidth={1} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         <div className="md:col-span-2 space-y-6">
                            <div>
                               <p className="font-serif text-[1.15rem] leading-relaxed text-[var(--color-graphite)] italic border-l-2 border-[var(--color-antique-gold)] pl-4">
                                 "{posData.essence}"
                               </p>
                            </div>
                            <div>
                               <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-2">Сила</h4>
                               <p className="font-serif text-lg leading-relaxed text-[var(--color-ink)]">{posData.strength}</p>
                            </div>
                            <div>
                               <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-2">Напряжение</h4>
                               <p className="font-serif text-lg leading-relaxed text-[var(--color-ink)]">{posData.tension}</p>
                            </div>
                            {posData.recommendation && (
                              <div className="bg-[var(--color-ivory)] p-4 border border-[var(--border-soft)]">
                                 <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-2">Наблюдение</h4>
                                 <p className="font-serif text-[1.05rem] leading-relaxed text-[var(--color-graphite)]">{posData.recommendation}</p>
                              </div>
                            )}
                         </div>
                         <div className="bg-[var(--color-marble)] p-6 border border-[var(--border-soft)]">
                            <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-4">Ядро энергии</h4>
                            <p className="font-serif text-[1.05rem] leading-relaxed text-[var(--color-graphite)] mb-6">{knowledge.core}</p>
                            <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-4">Теги</h4>
                            <div className="flex flex-col gap-2">
                              {knowledge.keywords.slice(0, 4).map(kw => (
                                <span key={kw} className="font-serif text-sm text-[var(--color-ink)] py-1 border-b border-[var(--border-soft)]">{kw}</span>
                              ))}
                            </div>
                         </div>
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
                      let content = <span className="font-sans text-sm text-[var(--color-border)] opacity-60">—</span>;

                      if (count > 0) {
                        content = <span className={`font-serif text-2xl sm:text-3xl ${count >= 3 ? 'font-medium' : ''}`}>{num.repeat(count)}</span>;
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

                      return (
                        <motion.button
                          key={`${matrixType}-${num}`}
                          title={`${cellMeaning}: ${count} цифр`}
                          onClick={() => setSelectedCell(selectedCell === num ? null : num)}
                          onMouseEnter={() => setHoveredLines(NUM_LINES[num])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: isSelected ? 1.05 : 1 }}
                          whileHover={{ scale: isSelected ? 1.05 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.4, delay: (isSelected || isHovered) ? 0 : index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center outline-none transition-colors duration-500 cursor-pointer ${bgColor} ${textColor} ${isSelected ? 'z-20' : 'hover:z-10 box-border'}`}
                        >
                          {content}
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
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center transition-colors duration-500 cursor-default ${isHovered ? LINE_STYLES['r'].bg + ' z-20 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]/40' : 'bg-[var(--color-surface)] bg-marble border-none shadow-sm'}`}
                        >
                          <span className={`font-serif text-lg transition-colors duration-300 ${(isHovered) ? LINE_STYLES['r'].text : (value >= 5 ? 'text-[var(--color-antique-gold)]' : 'text-[var(--color-muted)]')}`}>{value}</span>
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
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center transition-colors duration-500 cursor-default ${isAnyDActive ? LINE_STYLES['d'].bg + ' z-20 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]/40' : 'bg-[var(--color-surface)] bg-marble border-none shadow-sm'}`}
                        >
                          <div className="flex gap-2 sm:gap-3 mb-1">
                            <span className={`text-xs sm:text-[0.95rem] font-serif transition-colors duration-500 ${isD1Active ? LINE_STYLES['d'].text : 'text-[var(--color-ink)]'}`} title={`Внутренний компас (1-5-9): ${d1}`}>{d1}</span>
                            <span className="text-[var(--border-soft)]">/</span>
                            <span className={`text-xs sm:text-[0.95rem] font-serif transition-colors duration-500 ${isD2Active ? LINE_STYLES['d'].text : 'text-[var(--color-antique-gold)]'}`} title={`Темперамент (3-5-7): ${d2}`}>{d2}</span>
                          </div>
                          <span className={`text-[0.4rem] sm:text-[0.45rem] tracking-widest uppercase mt-1 text-center leading-[1.3] transition-colors duration-500 ${isAnyDActive ? LINE_STYLES['d'].text : 'text-[var(--color-muted)] opacity-50'}`}>ВНУТР.<br/>ТЕМП.</span>
                        </motion.div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>

            {/* First Mirror */}
            <div className="w-full flex flex-col items-center mb-12">
              {reading ? (
                <>
                  <FirstMirrorPanel data={reading} onCtaClick={handlePdfRequest} />
                  {demoNotice && (
                    <p className="text-center font-sans text-[0.7rem] tracking-[0.1em] text-[var(--color-muted)] uppercase mb-12 opacity-80">
                      {demoNotice}
                    </p>
                  )}
                  <BigResearchTeaser onCtaClick={handlePdfRequest} />
                </>
              ) : null}
            </div>

            {/* Lead Form Modal */}
            <LeadModal 
              isOpen={showLeadModal} 
              onClose={() => setShowLeadModal(false)} 
              source="code_big_research" 
              defaultBirthDate={date} 
              theme="light" 
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
