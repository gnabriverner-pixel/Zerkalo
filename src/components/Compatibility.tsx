import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Loader2, X } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { CalculationResult, ApiResponse } from '../types';

registerLocale('ru', ru);
import { calculateDigitalCode } from '../services/calculator';
import { CompatibilityPanel } from './CompatibilityPanel';
import { BigResearchTeaser } from './BigResearchTeaser';

const MeanderDivider = () => (
  <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto my-8 opacity-40">
    <path d="M0 6H10V1H20V11H30V6H40V1H50V11H60V6H70V1H80V11H90V6H100V1H110V11H120" stroke="var(--color-antique-gold)" strokeWidth="0.5" strokeMiterlimit="10"/>
  </svg>
);

export default function Compatibility() {
  const [date, setDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [date2, setDate2] = useState('');
  const [selectedDate2, setSelectedDate2] = useState<Date | null>(null);
  const [compatibilityReading, setCompatibilityReading] = useState<NonNullable<ApiResponse['compatibility_result']> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string, type: string } | null>(null);
  
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [pdfMessage, setPdfMessage] = useState('');
  const [demoNotice, setDemoNotice] = useState('');
  
  const [consentChecked, setConsentChecked] = useState(false);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) return;
    setErrorInfo(null);
    
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match1 = date.match(regex);
    const match2 = date2.match(regex);
    
    if (match1 && match2) {
      const day1 = parseInt(match1[1], 10);
      const month1 = parseInt(match1[2], 10);
      const day2 = parseInt(match2[1], 10);
      const month2 = parseInt(match2[2], 10);
      
      const valid2 = day2 > 0 && day2 <= 31 && month2 > 0 && month2 <= 12;
      
      if (day1 > 0 && day1 <= 31 && month1 > 0 && month1 <= 12 && valid2) {
        const calc = calculateDigitalCode(date);
        const calc2 = calculateDigitalCode(date2);
        
        setCompatibilityReading(null);
        setDemoNotice('');
        setIsGenerating(true);

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'compatibility', date, calc, date2, calc2 })
          });
          
          const data: ApiResponse = await res.json();
          if (data.status === 'ok' && data.compatibility_result) {
              setCompatibilityReading(data.compatibility_result);
          } else {
              setDemoNotice("Показана базовая версия. Для совместимости требуется работа LLM.");
          }
        } catch (err) {
          console.error(err);
          setErrorInfo({ message: "Ошибка при получении данных. Пожалуйста, проверьте подключение к интернету.", type: "network" });
        } finally {
          setIsGenerating(false);
        }
      } else {
        setErrorInfo({ message: "Некорректная дата. Проверьте день и месяц.", type: "validation" });
      }
    } else {
      setErrorInfo({ message: "Формат: ДД.ММ.ГГГГ", type: "validation" });
    }
  };

  const handlePdfRequest = async () => {
    setPdfStatus('submitting');
    setPdfMessage('Отправка запроса...');

    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthDate: date,
          birthDate2: date2,
        })
      });

      const data = await res.json();
      if (data.status === 'ok') {
        setPdfStatus('success');
        setPdfMessage(data.ui?.safe_message || "Ожидайте загрузку Большого исследования...");
      } else {
        setPdfStatus('success');
        setPdfMessage("Функционал генерации Большого исследования находится в разработке. Скоро эта возможность станет доступной.");
      }
    } catch (err) {
      setPdfStatus('error');
      setPdfMessage("Ошибка при составлении запроса. Пожалуйста, попробуйте позже.");
    }
  };

  return (
    <div className="flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-ivory)] bg-marble min-h-screen text-[var(--color-ink)] font-sans">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="text-center mb-16 pt-10"
      >
        <h1 className="font-serif text-5xl md:text-6xl tracking-widest uppercase mb-4 text-[var(--color-ink)]">
          Совместимость
        </h1>
        <p className="font-sans text-xs md:text-sm tracking-[0.3em] uppercase text-[var(--color-muted)] opacity-80">
          Точки соприкосновения судеб
        </p>
        <MeanderDivider />
        <p className="font-serif text-[1.1rem] md:text-xl text-[var(--color-muted)] mt-4 max-w-md mx-auto italic">
          Введите две даты рождения — система покажет пересечение внутренних архитектур.
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
        <div className="w-full space-y-4">
          <div className="relative w-full flex items-center group overflow-hidden">
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
              placeholderText="Первая дата"
              className="w-full bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl md:text-3xl py-4 outline-none transition-colors placeholder:text-[var(--color-border)] text-[var(--color-ink)] pr-12"
              wrapperClassName="w-full"
            />
          </div>

          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative w-full flex items-center group overflow-hidden"
          >
            <DatePicker
              selected={selectedDate2}
              onChange={(d: Date | null) => {
                setSelectedDate2(d);
                if (d) {
                  const dayStr = String(d.getDate()).padStart(2, '0');
                  const monthStr = String(d.getMonth() + 1).padStart(2, '0');
                  const yearStr = String(d.getFullYear());
                  setDate2(`${dayStr}.${monthStr}.${yearStr}`);
                } else {
                  setDate2('');
                }
              }}
              dateFormat="dd.MM.yyyy"
              locale="ru"
              showYearDropdown
              showMonthDropdown
              dropdownMode="select"
              placeholderText="Вторая дата"
              className="w-full bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl md:text-3xl py-4 outline-none transition-colors placeholder:text-[var(--color-border)] text-[var(--color-ink)] pr-16"
              wrapperClassName="w-full"
            />
            <button 
              type="submit" 
              disabled={isGenerating || date.length !== 10 || date2.length !== 10 || !consentChecked}
              className="absolute right-0 p-4 text-[var(--color-muted)] hover:text-[var(--color-antique-gold)] transition-colors disabled:opacity-30 disabled:hover:text-[var(--color-muted)]"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-6 h-6" strokeWidth={1} />
              )}
            </button>
          </motion.div>
          
          <div className="pt-4 flex items-center justify-center gap-3 w-full">
            <input 
              type="checkbox" 
              id="consent-compatibility" 
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-antique-gold)] cursor-pointer"
            />
            <label htmlFor="consent-compatibility" className="text-xs text-[var(--color-muted)] cursor-pointer select-none">
              Я согласен с условиями обработки персональных данных
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

      <AnimatePresence mode="wait">
        <motion.div
          key="compatibility-results"
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full flex flex-col items-center"
        >
          {isGenerating ? (
            <div className="flex flex-col items-center py-20 mt-12 mb-12 w-full max-w-4xl">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-antique-gold)] mb-6" />
              <p className="text-sm font-sans tracking-widest uppercase text-[var(--color-muted)] mb-8">Анализ совместимости...</p>
              
              {/* Skeleton Loader */}
              <div className="w-full bg-[var(--color-surface)] border border-[var(--border-soft)] p-8 md:p-12">
                <div className="h-8 w-64 bg-[var(--color-marble)] animate-pulse mx-auto mb-4"></div>
                <div className="w-16 h-px bg-[var(--color-antique-gold)] mx-auto opacity-50 mb-10"></div>
                <div className="space-y-6">
                  <div className="h-24 w-full bg-[var(--color-marble)] animate-pulse"></div>
                  <div className="h-4 w-32 bg-[var(--color-marble)] animate-pulse mb-8"></div>
                  <div className="h-4 w-full bg-[var(--color-marble)] animate-pulse"></div>
                  <div className="h-4 w-5/6 bg-[var(--color-marble)] animate-pulse"></div>
                  <div className="h-4 w-4/6 bg-[var(--color-marble)] animate-pulse"></div>
                  <div className="space-y-4 pt-8">
                     <div className="h-16 w-full bg-[var(--color-marble)] animate-pulse"></div>
                     <div className="h-16 w-full bg-[var(--color-marble)] animate-pulse"></div>
                     <div className="h-16 w-full bg-[var(--color-marble)] animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          ) : compatibilityReading ? (
            <>
              <CompatibilityPanel data={compatibilityReading} />
              {demoNotice && (
                <p className="text-center font-sans text-[0.7rem] tracking-[0.1em] text-[var(--color-muted)] uppercase mt-6 mb-12 opacity-80">
                  {demoNotice}
                </p>
              )}
              <BigResearchTeaser onCtaClick={() => { setShowPdfModal(true); handlePdfRequest(); }} />
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {/* Pdf Form Modal */}
      <AnimatePresence>
        {showPdfModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[var(--color-marble)] p-8 md:p-12 max-w-md w-full relative shadow-2xl border border-[var(--border-soft)]"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-30"></div>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="absolute top-6 right-6 text-[var(--color-muted)] hover:text-[var(--color-antique-gold)] transition-colors"
              >
                <X className="w-6 h-6" strokeWidth={1} />
              </button>
              
              <h3 className="font-serif text-3xl text-[var(--color-ink)] mb-4">Большое исследование</h3>
              
              {pdfStatus === 'submitting' ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-antique-gold)] mb-6" />
                  <p className="text-sm font-sans text-[var(--color-muted)]">{pdfMessage}</p>
                </div>
              ) : (
                <div className="bg-[var(--color-ivory)] border border-[var(--border-soft)] p-8 text-center font-serif text-[1.1rem]">
                  <p className="text-[var(--color-ink)]">{pdfMessage}</p>
                  <button 
                    onClick={() => setShowPdfModal(false)}
                    className="mt-8 px-8 py-3 bg-[var(--color-ink)] text-[var(--color-ivory)] font-sans text-xs tracking-[0.15em] uppercase hover:bg-black transition-colors"
                  >
                    Закрыть
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
