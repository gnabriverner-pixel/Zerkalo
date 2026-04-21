import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDigitalCode, CalculationResult } from './services/calculator';
import { Sparkles, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [date, setDate] = useState('');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [reading, setReading] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [matrixType, setMatrixType] = useState<'base' | 'detailed'>('detailed');

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
    setError('');
    
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = date.match(regex);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      
      if (day > 0 && day <= 31 && month > 0 && month <= 12) {
        const calc = calculateDigitalCode(date);
        setResult(calc);
        setReading('');
        setIsGenerating(true);

        try {
          const res = await fetch('/api/generate-reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, calc })
          });
          
          const data = await res.json();
          if (data.reading) {
            setReading(data.reading);
          } else if (data.error) {
            setError(data.error);
          }
        } catch (err) {
          console.error(err);
          setError("Ошибка при получении данных от Зеркала.");
        } finally {
          setIsGenerating(false);
        }

      } else {
        setError("Некорректная дата. Проверьте день и месяц.");
      }
    } else {
      setError("Формат: ДД.ММ.ГГГГ");
    }
  };

  const NumberCard = ({ title, value, composite, delay }: { title: string, value: number, composite: string, delay: number }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center p-6 border border-[var(--color-stone)] bg-white/50 backdrop-blur-sm"
    >
      <span className="font-sans text-xs tracking-widest uppercase text-gray-500 mb-4">{title}</span>
      <span className="font-serif text-5xl text-[var(--color-ink)] mb-2">{value}</span>
      {composite !== value.toString() && (
        <span className="font-sans text-sm text-[var(--color-gold)] tracking-widest">{composite}</span>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="text-center mb-16"
      >
        <h1 className="font-serif text-5xl md:text-7xl tracking-widest uppercase mb-4 text-[var(--color-ink)]">
          Зеркало
        </h1>
        <p className="font-sans text-sm md:text-base tracking-[0.3em] uppercase text-gray-400">
          Познай самого себя
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
        <div className="relative w-full flex items-center">
          <input
            type="text"
            value={date}
            onChange={handleDateChange}
            placeholder="ДД.ММ.ГГГГ"
            className="w-full bg-transparent border-b border-[var(--color-stone)] focus:border-[var(--color-gold)] text-center font-serif text-2xl py-4 outline-none transition-colors placeholder:text-gray-300"
          />
          <button 
            type="submit" 
            disabled={isGenerating || date.length !== 10}
            className="absolute right-0 p-4 text-gray-400 hover:text-[var(--color-gold)] transition-colors disabled:opacity-30"
          >
            <ArrowRight className="w-6 h-6" strokeWidth={1} />
          </button>
        </div>
      </motion.form>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-10 max-w-md text-center"
          >
            <span className="text-[var(--color-ink)] font-serif italic text-lg">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div 
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-5xl flex flex-col items-center"
          >
            <div className="flex items-center gap-3 mb-12">
              <Sparkles className="w-5 h-5 text-[var(--color-gold)]" strokeWidth={1} />
              <h2 className="font-serif text-2xl italic text-[var(--color-ink)]">Архитектура Кода</h2>
              <Sparkles className="w-5 h-5 text-[var(--color-gold)]" strokeWidth={1} />
            </div>

            {/* 5 Main Numbers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full mb-16">
              <NumberCard title="Душа" value={result.soul} composite={result.soulComposite} delay={0.1} />
              <NumberCard title="Путь" value={result.path} composite={result.pathComposite} delay={0.2} />
              <NumberCard title="Направление" value={result.direction} composite={result.directionComposite} delay={0.3} />
              <NumberCard title="Выражение" value={result.expression} composite={result.expressionComposite} delay={0.4} />
              <NumberCard title="Результат" value={result.result} composite={result.resultComposite} delay={0.5} />
            </div>

            {/* Matrix Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="w-full max-w-md flex flex-col items-center mb-16"
            >
              <div className="flex gap-6 mb-8">
                <button 
                  onClick={() => setMatrixType('base')}
                  className={`font-sans text-xs tracking-widest uppercase transition-all duration-300 pb-1 ${matrixType === 'base' ? 'text-[var(--color-gold)] border-b border-[var(--color-gold)]' : 'text-gray-400 hover:text-gray-600 border-b border-transparent'}`}
                >
                  Базовая
                </button>
                <button 
                  onClick={() => setMatrixType('detailed')}
                  className={`font-sans text-xs tracking-widest uppercase transition-all duration-300 pb-1 ${matrixType === 'detailed' ? 'text-[var(--color-gold)] border-b border-[var(--color-gold)]' : 'text-gray-400 hover:text-gray-600 border-b border-transparent'}`}
                >
                  Детальная
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-px bg-[var(--color-stone)] border border-[var(--color-stone)]">
                {['1', '4', '7', '2', '5', '8', '3', '6', '9'].map((num) => {
                  const activeMatrix = matrixType === 'base' ? result.baseMatrix : result.detailedMatrix;
                  const count = activeMatrix[num] || 0;
                  return (
                    <div key={num} className="bg-[var(--color-alabaster)] w-24 h-24 flex items-center justify-center transition-colors duration-500">
                      {count > 0 ? (
                        <span className="font-serif text-2xl text-[var(--color-ink)]">
                          {num.repeat(count)}
                        </span>
                      ) : (
                        <span className="font-sans text-sm text-gray-300">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* AI Generation Loading State */}
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center my-12"
              >
                <div className="relative flex items-center justify-center w-16 h-16 mb-6">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border border-[var(--color-gold)] rounded-full opacity-30"
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 border border-[var(--color-gold)] rounded-full opacity-50"
                  />
                  <Sparkles className="w-6 h-6 text-[var(--color-gold)] animate-pulse" />
                </div>
                <motion.span 
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="font-serif italic text-xl text-[var(--color-ink)] tracking-wide"
                >
                  Создание зеркала души...
                </motion.span>
              </motion.div>
            )}

            {/* AI Reading Markdown */}
            {reading && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="w-full max-w-3xl bg-white/40 backdrop-blur-md border border-[var(--color-stone)] p-8 md:p-16 shadow-sm"
              >
                <div className="markdown-body">
                  <ReactMarkdown>{reading}</ReactMarkdown>
                </div>
              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
