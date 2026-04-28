import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { CalculationResult, ApiResponse } from '../types';
import { calculateDigitalCode } from '../services/calculator';
import { generateFirstMirror } from '../services/interpretation';
import ReactMarkdown from 'react-markdown';

const NUMBER_MEANINGS: Record<string, { title: string, text: string }> = {
  '1': { title: 'Характер / Воля', text: 'Указывает на уровень эгоизма, силы воли, лидерских качеств и амбиций.' },
  '2': { title: 'Энергия', text: 'Жизненная сила, необходимая для действий, общения и создания.' },
  '3': { title: 'Интерес / Творчество', text: 'Склонность к наукам, технологиям, интерес к познанию мира.' },
  '4': { title: 'Здоровье', text: 'Физическая выносливость, сила тела и генетика.' },
  '5': { title: 'Логика / Интуиция', text: 'Способность планировать, анализировать и предвидеть ситуации.' },
  '6': { title: 'Мастерство / Труд', text: 'Склонность к физическому труду, ремеслу и заземлению.' },
  '7': { title: 'Талант / Удача', text: 'Сила ангела-хранителя, везение, творческий потенциал.' },
  '8': { title: 'Долг / Ответственность', text: 'Уровень терпимости к близким людям, чувство долга и правосудия.' },
  '9': { title: 'Память / Ум', text: 'Аналитические способности, интеллект и предвидение.' }
};

const MAIN_POSITIONS_DEF: Record<string, string> = {
  'Душа': 'Отражает ваши глубинные желания, истинную мотивацию и внутренний мир. Это фундамент вашей личности и то, чего вы по-настоящему хотите.',
  'Путь': 'Указывает на вашу основную жизненную стратегию, уроки, которые предстоит пройти, и глобальный маршрут вашего развития.',
  'Направление': 'Определяет ваш вектор развития в социуме, профессиональные склонности и то, как вас воспринимают окружающие.',
  'Выражение': 'Раскрывает ваши врожденные таланты, способности и тот способ, которым вы лучше всего взаимодействуете с внешним миром.',
  'Результат': 'Показывает итог, к которому вы бессознательно стремитесь, ваши главные жизненные достижения и точку опоры в зрелости.'
};

const NUM_LINES: Record<string, string[]> = {
  '1': ['r1', 'c1', 'd1'], '4': ['r1', 'c2'], '7': ['r1', 'c3', 'd2'],
  '2': ['r2', 'c1'], '5': ['r2', 'c2', 'd1', 'd2'], '8': ['r2', 'c3'],
  '3': ['r3', 'c1', 'd2'], '6': ['r3', 'c2'], '9': ['r3', 'c3', 'd1']
};

const LINE_STYLES: Record<string, { bg: string, bgEmpty: string, text: string }> = {
  'r': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-gold)]' },
  'c': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-gold)]' },
  'd': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-gold)]' }
};

export default function CodeArchitecture() {
  const [date, setDate] = useState('');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [reading, setReading] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string, type: string } | null>(null);
  const [matrixType, setMatrixType] = useState<'base' | 'detailed'>('detailed');
  const [hoveredLines, setHoveredLines] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectedMainNumber, setSelectedMainNumber] = useState<string | null>(null);
  
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', contact: '', request: '' });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [leadMessage, setLeadMessage] = useState('');
  const [demoNotice, setDemoNotice] = useState('');

  const matrixRef = useRef<HTMLDivElement>(null);
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    let formatted = val;
    if (val.length >= 5) {
      formatted = `${val.slice(0, 2)}.${val.slice(2, 4)}.${val.slice(4)}`;
    } else if (val.length >= 3) {
      formatted = `${val.slice(0, 2)}.${val.slice(2)}`;
    }
    setDate(formatted);
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setSelectedCell(null);
    setHoveredLines([]);
    
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = date.match(regex);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      
      if (day > 0 && day <= 31 && month > 0 && month <= 12) {
        const calc = calculateDigitalCode(date);
        setResult(calc);
        setReading('');
        setDemoNotice('');
        setIsGenerating(true);

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'code', date, calc })
          });
          
          const data: ApiResponse = await res.json();
          if (data.status === 'ok' && data.code_result) {
            setReading(data.code_result.mirror_text);
          } else if (data.status === 'error' || data.status === 'demo') {
             if (data.ui?.safe_message && data.status === 'demo') {
               setDemoNotice(data.ui.safe_message);
               setReading(generateFirstMirror(calc));
             } else if (data.status === 'error' && data.ui?.safe_message) {
               setErrorInfo({ message: data.ui.safe_message, type: "network" });
               setDemoNotice("Показана базовая версия первого слоя. Полная персональная генерация доступна в Большом исследовании.");
               setReading(generateFirstMirror(calc));
             } else {
               setDemoNotice("Показана базовая версия первого слоя. Полная персональная генерация доступна в Большом исследовании.");
               setReading(generateFirstMirror(calc));
             }
          }
        } catch (err) {
          console.error(err);
          setErrorInfo({ message: "Ошибка при получении данных. Пожалуйста, проверьте подключение к интернету.", type: "network" });
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

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadStatus('submitting');
    setLeadMessage('');

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          birthDate: date,
          source: 'CodeArchitecture_BigResearch_CTA'
        })
      });

      const data = await res.json();
      if (data.status === 'ok') {
        setLeadStatus('success');
        setLeadMessage(data.ui?.safe_message || "Заявка успешно отправлена.");
      } else {
        setLeadStatus('error');
        setLeadMessage(data.ui?.safe_message || "Произошла ошибка при отправке.");
      }
    } catch (err) {
      setLeadStatus('error');
      setLeadMessage("Ошибка сети. Пожалуйста, попробуйте позже.");
    }
  };

  const NumberCard = ({ title, value, composite, delay }: { title: string, value: number, composite: string, delay: number }) => (
    <motion.button 
      type="button"
      onClick={() => setSelectedMainNumber(selectedMainNumber === title ? null : title)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center p-8 bg-[var(--color-surface)] ${selectedMainNumber === title ? 'bg-[var(--color-ivory)]' : 'hover:bg-[var(--color-ivory)]'} relative overflow-hidden group transition-all duration-500 w-full outline-none`}
    >
      <span className={`font-sans text-[10px] md:text-xs tracking-[0.2em] uppercase mb-6 z-10 transition-colors duration-500 text-[var(--color-muted)]`}>
        {title}
      </span>
      <div className="flex flex-col items-center z-10">
        <span className={`font-serif text-5xl md:text-6xl leading-none transition-colors duration-500 ${selectedMainNumber === title ? 'text-[var(--color-gold)]' : 'text-[var(--color-ink)]'}`}>
          {value}
        </span>
        {composite !== value.toString() ? (
          <span className={`font-serif text-sm mt-4 tracking-widest transition-colors duration-500 ${selectedMainNumber === title ? 'text-[var(--color-gold)] opacity-80' : 'text-[var(--color-muted)]'}`}>
            {composite}
          </span>
        ) : (
          <span className="font-serif text-sm mt-4 opacity-0 select-none tracking-widest">—</span>
        )}
      </div>
    </motion.button>
  );

  return (
    <div className="flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-ivory)] min-h-screen text-[var(--color-ink)] font-sans">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="text-center mb-16 pt-10"
      >
        <h1 className="font-serif text-5xl md:text-6xl tracking-widest uppercase mb-4 text-[var(--color-ink)]">
          Зеркало
        </h1>
        <p className="font-sans text-xs md:text-sm tracking-[0.3em] uppercase text-[var(--color-muted)] opacity-80">
          Познай самого себя
        </p>
        <div className="w-8 h-[1px] bg-[var(--color-gold)] opacity-50 mx-auto mt-8"></div>
        <p className="font-serif text-[1.1rem] md:text-xl text-[var(--color-muted)] mt-8 max-w-md mx-auto italic">
          Введите дату рождения — система покажет первый слой вашей внутренней архитектуры.
        </p>
      </motion.div>

      {/* Input Form */}
      <motion.form 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        onSubmit={handleCalculate} 
        className="w-full max-w-md flex flex-col items-center mb-10"
      >
        <div className="relative w-full flex items-center group">
          <input
            type="text"
            value={date}
            onChange={handleDateChange}
            placeholder="ДД.ММ.ГГГГ"
            className="w-full bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-gold)] text-center font-serif text-2xl md:text-3xl py-4 outline-none transition-colors placeholder:text-[var(--color-border)] text-[var(--color-ink)]"
          />
          <button 
            type="submit" 
            disabled={isGenerating || date.length !== 10}
            className="absolute right-0 p-4 text-[var(--color-muted)] hover:text-[var(--color-gold)] transition-colors disabled:opacity-30 disabled:hover:text-[var(--color-muted)]"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowRight className="w-6 h-6" strokeWidth={1} />
            )}
          </button>
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
        {result && (
          <motion.div 
            key="results"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl flex flex-col items-center"
          >
            <div className="flex flex-col items-center gap-3 mb-10 w-full text-center">
              <h2 className="font-serif text-3xl text-[var(--color-ink)] mb-2">Архитектура Кода</h2>
              <div className="w-10 h-[1px] bg-[var(--color-gold)] opacity-50 mx-auto"></div>
            </div>

            {/* 5 Main Numbers Grid */}
            <div className={`grid grid-cols-2 md:grid-cols-5 gap-px bg-[var(--color-border)] w-full ${selectedMainNumber ? 'mb-2' : 'mb-16'} transition-all duration-500`}>
              <NumberCard title="Душа" value={result.soul} composite={result.soulComposite} delay={0.1} />
              <NumberCard title="Путь" value={result.path} composite={result.pathComposite} delay={0.2} />
              <NumberCard title="Направление" value={result.direction} composite={result.directionComposite} delay={0.3} />
              <NumberCard title="Выражение" value={result.expression} composite={result.expressionComposite} delay={0.4} />
               <div className="col-span-2 md:col-span-1">
                 <NumberCard title="Результат" value={result.result} composite={result.resultComposite} delay={0.5} />
               </div>
            </div>

            {/* Main Number Detail Modal/Section */}
            <AnimatePresence>
              {selectedMainNumber && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="w-full overflow-hidden mb-16"
                >
                  <div className="p-8 md:p-10 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20"></div>
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="font-serif text-2xl md:text-3xl text-[var(--color-ink)] tracking-wide">{selectedMainNumber}</h3>
                      <button 
                        onClick={() => setSelectedMainNumber(null)}
                        className="text-[var(--color-muted)] hover:text-[var(--color-gold)] transition-colors p-2 -mt-2 -mr-2"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="font-serif text-[1.1rem] leading-relaxed max-w-3xl text-[var(--color-ink)]">
                      {MAIN_POSITIONS_DEF[selectedMainNumber]}
                    </p>
                  </div>
                </motion.div>
              )}
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
                    className={`font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 pb-2 outline-none ${matrixType === 'base' ? 'text-[var(--color-ink)] border-b border-[var(--color-gold)] opacity-100' : 'text-[var(--color-muted)] border-b border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    Базовая
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMatrixType('detailed')}
                    className={`font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 pb-2 outline-none ${matrixType === 'detailed' ? 'text-[var(--color-ink)] border-b border-[var(--color-gold)] opacity-100' : 'text-[var(--color-muted)] border-b border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    Детальная
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-px bg-[var(--color-border)] border border-[var(--color-border)] shadow-sm">
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
                      
                      let bgColor = "bg-[var(--color-surface)]";
                      let textColor = "text-[var(--color-ink)]";
                      let content = <span className="font-sans text-sm text-[var(--color-border)] opacity-60">—</span>;

                      if (count > 0) {
                        content = <span className={`font-serif text-2xl sm:text-3xl ${count >= 3 ? 'font-medium' : ''}`}>{num.repeat(count)}</span>;
                      }

                      if (isSelected) {
                        bgColor = "bg-[var(--color-ivory)] z-10 relative opacity-100 shadow-sm";
                        if (count >= 3) textColor = "text-[var(--color-gold)]";
                      } else if (isHovered && hoverLine) {
                        bgColor = count > 0 ? LINE_STYLES['r'].bg : LINE_STYLES['r'].bgEmpty;
                        textColor = LINE_STYLES['r'].text;
                      } else if (count > 0) {
                        bgColor = count >= 3 ? "bg-[var(--color-ivory)]" : "bg-[var(--color-surface)]";
                        if (count >= 3) textColor = "text-[var(--color-gold)]";
                      }

                      return (
                        <motion.button
                          key={`${matrixType}-${num}`}
                          onClick={() => setSelectedCell(selectedCell === num ? null : num)}
                          onMouseEnter={() => setHoveredLines(NUM_LINES[num])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.04 }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center outline-none transition-colors duration-300 cursor-pointer ${bgColor} ${textColor}`}
                        >
                          {content}
                        </motion.button>
                      );
                    };

                    const LineSum = ({ label, value, index, lineId }: { label: string, value: number, index: number, lineId: string }) => {
                      const isHovered = hoveredLines.includes(lineId);
                      
                      return (
                        <motion.div
                          key={`${matrixType}-${label}`}
                          onMouseEnter={() => setHoveredLines([lineId])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.04 }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center transition-colors duration-300 cursor-default ${isHovered ? LINE_STYLES['r'].bg : 'bg-[var(--color-surface)]'}`}
                        >
                          <span className={`font-serif text-lg transition-colors duration-300 ${(isHovered) ? LINE_STYLES['r'].text : (value >= 5 ? 'text-[var(--color-gold)]' : 'text-[var(--color-muted)]')}`}>{value}</span>
                          <span className={`text-[0.45rem] sm:text-[0.55rem] tracking-widest uppercase mt-1 transition-colors duration-300 ${isHovered ? LINE_STYLES['r'].text : 'text-[var(--color-muted)] opacity-60'}`}>{label}</span>
                        </motion.div>
                      );
                    };

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
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 15 * 0.04 }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center transition-colors duration-300 cursor-default ${(hoveredLines.includes('d1') || hoveredLines.includes('d2')) ? LINE_STYLES['d'].bg : 'bg-[var(--color-surface)]'}`}
                        >
                          <div className="flex gap-2 sm:gap-3 mb-1">
                            <span className={`text-xs sm:text-sm font-serif transition-colors duration-300 ${hoveredLines.includes('d1') ? LINE_STYLES['d'].text : 'text-[var(--color-ink)]'}`} title={`Духовность (1-5-9): ${d1}`}>{d1}</span>
                            <span className="text-[var(--color-border)]">/</span>
                            <span className={`text-xs sm:text-sm font-serif transition-colors duration-300 ${hoveredLines.includes('d2') ? LINE_STYLES['d'].text : 'text-[var(--color-gold)]'}`} title={`Темперамент (3-5-7): ${d2}`}>{d2}</span>
                          </div>
                          <span className={`text-[0.4rem] sm:text-[0.45rem] tracking-widest uppercase mt-1 text-center leading-[1.2] transition-colors duration-300 ${hoveredLines.includes('d1') || hoveredLines.includes('d2') ? LINE_STYLES['d'].text : 'text-[var(--color-muted)] opacity-60'}`}>ДУХ.<br/>ТЕМП.</span>
                        </motion.div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <AnimatePresence>
                {selectedCell && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full max-w-md mt-6 bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] relative"
                  >
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20"></div>
                     <div className="p-8 relative">
                       <button 
                         onClick={() => setSelectedCell(null)}
                         className="absolute top-4 right-4 text-[var(--color-muted)] hover:text-[var(--color-gold)] transition-colors p-2"
                       >
                         ✕
                       </button>
                       <div className="flex items-start mb-4 border-b border-[var(--color-border)] pb-4 pr-8">
                          <h3 className="font-serif text-xl md:text-2xl text-[var(--color-ink)] flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[var(--color-ivory)] border border-[var(--color-border)] text-[var(--color-gold)] flex items-center justify-center font-medium shadow-sm">
                              {selectedCell}
                            </div>
                            {NUMBER_MEANINGS[selectedCell]?.title}
                          </h3>
                       </div>
                       <div className="flex justify-between items-end mb-1">
                          <p className="font-serif text-[1.05rem] text-[var(--color-ink)] leading-relaxed flex-1">
                            {NUMBER_MEANINGS[selectedCell]?.text}
                          </p>
                          <div className="flex flex-col items-end ml-6 pl-6 border-l border-[var(--color-border)] opacity-80">
                             <span className="font-sans text-[9px] text-[var(--color-muted)] uppercase tracking-wider mb-2 text-right">В матрице</span>
                             <span className="font-serif text-3xl text-[var(--color-gold)] leading-none">
                               {(matrixType === 'base' ? result.baseMatrix[selectedCell] : result.detailedMatrix[selectedCell]) || 0}
                             </span>
                          </div>
                       </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* First Mirror */}
            <div className="w-full max-w-3xl flex flex-col items-center mt-12 mb-24">
              <div className="text-center mb-10">
                <h3 className="font-serif text-4xl text-[var(--color-ink)] mb-3">Первое зеркало</h3>
                <p className="font-sans text-sm tracking-wide text-[var(--color-muted)] uppercase">Короткий первый слой по вашей дате рождения</p>
                <div className="w-12 h-[1px] bg-[var(--color-gold)] opacity-50 mx-auto mt-6"></div>
              </div>
              
              {isGenerating ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-gold)] mb-6" />
                  <p className="text-sm font-sans tracking-widest uppercase text-[var(--color-muted)]">Проявление архитектуры...</p>
                </div>
              ) : reading ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full mb-12 p-8 md:p-14 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.03)] relative"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20"></div>
                  <div className="premium-mirror text-left">
                    <ReactMarkdown>{reading}</ReactMarkdown>
                  </div>
                  {demoNotice && (
                    <div className="mt-12 pt-6 border-t border-[var(--color-border)] opacity-70">
                      <p className="text-center font-sans text-xs tracking-wide text-[var(--color-muted)]">
                        {demoNotice}
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : null}

              {reading && !isGenerating && (
                 <div className="w-full max-w-lg text-center flex flex-col items-center">
                   <h4 className="font-serif text-2xl text-[var(--color-ink)] mb-4">Хотите увидеть полную карту?</h4>
                   <p className="font-sans text-sm md:text-base text-[var(--color-muted)] leading-relaxed mb-8">
                     Большое исследование раскрывает не только числа, но и связи между ними: внутренние опоры, напряжения, сценарии выбора и личный маршрут.
                   </p>
                   <button 
                     onClick={() => setShowLeadForm(true)}
                     className="px-10 py-5 bg-[var(--color-ink)] text-[var(--color-ivory)] font-sans text-xs tracking-[0.15em] uppercase hover:bg-gray-800 transition-colors"
                   >
                     Получить Большое исследование
                   </button>
                   <p className="text-[10px] text-[var(--color-muted)] font-sans tracking-wide uppercase mt-6 max-w-xs opacity-70 border-t border-[var(--color-border)] pt-4">
                     Информационно-аналитический формат. Не диагноз и не предсказание.
                   </p>
                 </div>
              )}
            </div>
            
            {/* Lead Form Modal */}
            <AnimatePresence>
              {showLeadForm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/60 p-4 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="bg-[var(--color-surface)] p-8 md:p-12 max-w-md w-full relative shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-[var(--color-border)]"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-30"></div>
                    <button 
                      onClick={() => setShowLeadForm(false)}
                      className="absolute top-6 right-6 text-[var(--color-muted)] hover:text-[var(--color-gold)] transition-colors"
                    >
                      ✕
                    </button>
                    
                    <h3 className="font-serif text-3xl text-[var(--color-ink)] mb-4">Большое исследование</h3>
                    <p className="font-sans text-[0.95rem] text-[var(--color-muted)] mb-8 leading-relaxed">Оставьте заявку, и я свяжусь с вами, чтобы обсудить детали и начать работу над вашим персональным разбором.</p>
                    
                    {leadStatus === 'success' ? (
                      <div className="bg-[var(--color-ivory)] border border-[var(--color-border)] p-8 text-center font-serif text-[1.1rem]">
                        <p className="text-[var(--color-ink)]">{leadMessage}</p>
                        <button 
                          onClick={() => setShowLeadForm(false)}
                          className="mt-8 px-8 py-3 bg-[var(--color-ink)] text-[var(--color-ivory)] font-sans text-xs tracking-[0.15em] uppercase hover:bg-gray-800 transition-colors"
                        >
                          Закрыть
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleLeadSubmit} className="flex flex-col gap-5">
                        <input 
                          type="text" 
                          placeholder="Ваше имя" 
                          required
                          value={leadForm.name}
                          onChange={e => setLeadForm({...leadForm, name: e.target.value})}
                          className="w-full bg-[var(--color-ivory)] border-b border-[var(--color-border)] p-4 font-serif text-lg outline-none focus:border-[var(--color-gold)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] placeholder:opacity-60 transition-colors"
                        />
                        <input 
                          type="text" 
                          placeholder="Ваш контакт (Telegram, Email...)" 
                          required
                          value={leadForm.contact}
                          onChange={e => setLeadForm({...leadForm, contact: e.target.value})}
                          className="w-full bg-[var(--color-ivory)] border-b border-[var(--color-border)] p-4 font-serif text-lg outline-none focus:border-[var(--color-gold)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] placeholder:opacity-60 transition-colors"
                        />
                        <textarea 
                          placeholder="Какой у вас сейчас главный запрос? (необязательно)" 
                          rows={3}
                          value={leadForm.request}
                          onChange={e => setLeadForm({...leadForm, request: e.target.value})}
                          className="w-full bg-[var(--color-ivory)] border-b border-[var(--color-border)] p-4 font-serif text-lg outline-none focus:border-[var(--color-gold)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] placeholder:opacity-60 transition-colors resize-none mt-2"
                        ></textarea>
                        
                        {leadStatus === 'error' && (
                          <div className="text-red-800 bg-red-50 p-3 text-sm font-sans mt-2 border border-red-100">{leadMessage}</div>
                        )}
                        
                        <button 
                          type="submit" 
                          disabled={leadStatus === 'submitting'}
                          className="mt-6 w-full py-5 bg-[var(--color-gold)] text-white font-sans text-xs tracking-[0.15em] uppercase hover:bg-[#A07A3B] transition-colors disabled:opacity-50 flex justify-center items-center shadow-sm"
                        >
                          {leadStatus === 'submitting' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Отправить заявку'}
                        </button>
                      </form>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
