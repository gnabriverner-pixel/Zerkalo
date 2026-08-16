import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Orb } from './Orb';
import { PantheonModal } from './PantheonModal';
import { CalculationResult, ApiResponse } from '../types';
import { validateBirthDate } from '../services/birthDate';
import mirrorHero from '../assets/mirror-hero.jpg';

interface LabEntryViewProps {
  onSelectMyth?: () => void;
  onSelectCode?: (initialDate?: string) => void;
  onSelectMeeting?: () => void;
  onOpenPantheon?: () => void;
  onSelectMode?: (mode: 'entry' | 'code' | 'myth' | 'meeting' | 'ab-test', initialDate?: string) => void;
  hasCodeResult?: boolean;
  hasMythResult?: boolean;
  codeResult?: CalculationResult | null;
  storyResult?: ApiResponse['story_result'] | null;
}

export function LabEntryView({
  onSelectMyth,
  onSelectCode,
  onSelectMeeting,
  onOpenPantheon,
  onSelectMode,
  hasCodeResult,
  hasMythResult,
  codeResult,
  storyResult,
}: LabEntryViewProps) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [dateError, setDateError] = useState('');
  const [isPantheonOpen, setIsPantheonOpen] = useState(false);

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const hasCode = hasCodeResult !== undefined ? hasCodeResult : !!codeResult;
  const hasMyth = hasMythResult !== undefined ? hasMythResult : !!storyResult;
  const isMeetingReady = hasCode && hasMyth;

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
      handleCodeSubmit();
    }
  };

  const handleCodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validation = validateBirthDate(day, month, year);

    if (validation.valid) {
      if (onSelectCode) {
        onSelectCode(validation.formatted);
      } else if (onSelectMode) {
        onSelectMode('code', validation.formatted);
      }
    } else {
      if (!day || !month || !year) {
        // If empty, just open code tab directly
        if (onSelectCode) onSelectCode();
        else if (onSelectMode) onSelectMode('code');
      } else {
        setDateError('message' in validation ? validation.message : 'Проверьте дату рождения');
      }
    }
  };

  const handleMyth = () => {
    if (onSelectMyth) onSelectMyth();
    else if (onSelectMode) onSelectMode('myth');
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8 text-[var(--color-text-primary)] font-sans relative overflow-x-hidden w-full selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      <div className="absolute inset-x-0 top-0 h-[900px] overflow-hidden pointer-events-none" aria-hidden="true">
        <img src={mirrorHero} alt="" className="h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_58%_at_50%_38%,transparent_0%,rgba(9,13,21,0.3)_48%,#090D15_92%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#090D15]" />
      </div>
      
      {/* Central Content */}
      <div className="w-full max-w-5xl flex flex-col items-center relative z-10 my-auto text-center space-y-24 pb-24">
        
        {/* ========================================================= */}
        {/* 1. HERO HEADER */}
        {/* ========================================================= */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="min-h-[78svh] flex flex-col items-center justify-center space-y-6 max-w-3xl mx-auto pt-12"
        >
          <span className="text-[11px] uppercase tracking-[0.35em] text-[var(--color-antique-gold)] font-mono block opacity-90">
            Личная коллекция отражений
          </span>

          <h1 className="font-serif text-6xl sm:text-7xl lg:text-[88px] text-[var(--color-text-primary)] font-light tracking-tight leading-[0.95]">
            Зеркало себя
          </h1>

          <p className="text-[var(--color-text-secondary)] font-light text-[17px] sm:text-[18px] max-w-2xl mx-auto leading-[1.7] pt-2">
            Иногда себя легче увидеть не напрямую. Здесь два независимых зеркала: одно возникает из даты рождения, другое — из ваших собственных образов.
          </p>

          <a href="#collection" className="mt-7 inline-flex min-h-12 items-center justify-center border border-[var(--color-border-gold)] bg-[#111723]/80 px-9 py-3 text-[11px] uppercase tracking-[0.28em] text-[var(--color-antique-gold)] transition-colors hover:bg-[#18202e]">
            Войти в коллекцию
          </a>
          <p className="text-xs text-[var(--color-text-muted)]">Начните с любого зеркала. Встреча откроется только после обоих.</p>
        </motion.div>

        {/* ========================================================= */}
        {/* 2. THE TWO GATES (ДВЕ НЕЗАВИСИМЫЕ ДВЕРИ) */}
        {/* ========================================================= */}
        <section id="collection" className="w-full max-w-4xl mx-auto scroll-mt-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="text-[10px] uppercase tracking-[0.32em] text-[var(--color-antique-gold)] font-mono">Коллекция зеркал</span>
            <h2 className="mt-5 font-serif text-4xl sm:text-5xl font-light">Два самостоятельных взгляда</h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">Система не смешивает дату с ответами и не придумывает сходство заранее.</p>
          </div>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* DOOR 1: PERSONAL MYTH */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            onClick={handleMyth}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleMyth();
              }
            }}
            role="button"
            tabIndex={0}
            className="group relative flex flex-col items-center justify-between p-10 sm:p-12 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-gold)] transition-all duration-500 cursor-pointer text-center"
          >
            <div className="flex flex-col items-center w-full">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-text-muted)] mb-8">
                Независимое зеркало · Личный миф
              </span>

              <div className="my-3 transition-transform duration-700 group-hover:scale-105">
                <Orb number={7} size={150} showNumber={false} glow={true} />
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light mt-8 mb-3">
                Сказка про вас
              </h2>

              <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed max-w-xs mb-8">
                Через 4 вопроса о вашем восприятии. Внутреннее состояние превращается в живую метафорическую историю.
              </p>
            </div>

            <div className="w-full pt-4 border-t border-[var(--color-border-subtle)]">
              <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-antique-gold)] font-mono group-hover:tracking-[0.3em] transition-all">
                {hasMyth ? 'Открыть созданную сказку →' : 'Войти через образы →'}
              </span>
            </div>
          </motion.div>

          {/* DOOR 2: DIGITAL CODE */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="group relative flex flex-col items-center justify-between p-10 sm:p-12 rounded-xs bg-[#0D121D] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-gold)] transition-all duration-500 text-center"
          >
            <div className="flex flex-col items-center w-full">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-text-muted)] mb-8">
                Независимое зеркало · Цифровой код
              </span>

              <div className="my-3 transition-transform duration-700 group-hover:scale-105">
                <Orb number={1} size={150} glow={true} />
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl text-[var(--color-text-primary)] font-light mt-8 mb-3">
                Архитектура природы
              </h2>

              <p className="text-sm text-[var(--color-text-secondary)] font-light leading-relaxed max-w-xs mb-6">
                Через дату рождения. Пять математических ключей и пошаговый разворот вашей карты.
              </p>

              {/* THREE CLEAN DATE FIELDS: [ ДД ] [ ММ ] [ ГГГГ ] */}
              <form onSubmit={handleCodeSubmit} className="w-full flex flex-col items-center space-y-4 mb-4">
                <div className="flex items-center justify-center gap-2 sm:gap-3">
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
                      className="w-14 sm:w-16 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl sm:text-[26px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                    />
                  </div>
                  <span className="text-[var(--color-text-muted)] font-serif text-xl">·</span>
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
                      className="w-14 sm:w-16 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl sm:text-[26px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                    />
                  </div>
                  <span className="text-[var(--color-text-muted)] font-serif text-xl">·</span>
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
                      className="w-20 sm:w-24 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-2xl sm:text-[26px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1.5 transition-colors"
                    />
                  </div>
                </div>

                {dateError && (
                  <span className="text-xs text-red-300 font-light block">{dateError}</span>
                )}

                <button
                  type="submit"
                  className="px-6 py-2.5 mt-2 border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] rounded-xs uppercase tracking-[0.2em] text-[11px] font-medium transition-all cursor-pointer"
                >
                  Рассчитать код
                </button>
              </form>
            </div>

            <div className="w-full pt-4 border-t border-[var(--color-border-subtle)]">
              <span 
                onClick={handleCodeSubmit}
                className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-antique-gold)] font-mono group-hover:tracking-[0.3em] transition-all cursor-pointer"
              >
                {hasCode ? 'Открыть карту кода →' : 'Развернуть ключи →'}
              </span>
            </div>
          </motion.div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. SYNTHESIS BANNER (MEETING OF MIRRORS) */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          onClick={handleMeeting}
          className={`w-full max-w-4xl p-8 sm:p-10 rounded-xs border transition-all duration-700 flex flex-col sm:flex-row items-center justify-between gap-6 text-left ${
            isMeetingReady
              ? 'bg-[var(--color-bg-surface)] border-[var(--color-border-gold)] shadow-[0_0_30px_rgba(200,164,93,0.1)] cursor-pointer hover:border-[var(--color-antique-gold)]'
              : 'bg-[var(--color-bg-surface)]/50 border-[var(--color-border-subtle)] cursor-pointer hover:border-[var(--color-border-gold)]'
          }`}
        >
          <div className="flex items-center gap-6">
            <div className="flex -space-x-3 shrink-0">
              <Orb number={codeResult?.soul || 1} size={44} glow={false} />
              <Orb number={7} size={44} glow={false} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light">
                  Встреча Зеркал
                </span>
                {isMeetingReady && (
                  <span className="text-[9px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-border-gold)] text-[var(--color-antique-gold)]">
                    Готово к синтезу
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] font-light mt-1 max-w-lg leading-relaxed">
                Сопоставление двух независимых отражений: поиск параллелей, честное осмысление расхождений и синтез-вопрос.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono whitespace-nowrap shrink-0">
            <span>{isMeetingReady ? 'Провести встречу →' : 'Узнать больше →'}</span>
          </div>
        </motion.div>

        {/* ========================================================= */}
        {/* 4. PANTHEON TEASER */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="w-full max-w-4xl pt-12 border-t border-[var(--color-border-subtle)] flex flex-col items-center"
        >
          <div className="flex items-center justify-between w-full mb-8">
            <div className="text-left">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)] block mb-1">
                Канон Вяземского
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light">
                Пантеон девяти архетипов
              </h3>
            </div>

            <button
              onClick={handlePantheon}
              className="text-xs uppercase font-mono tracking-[0.2em] text-[var(--color-antique-gold)] hover:underline transition-colors cursor-pointer"
            >
              Смотреть все девять →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
            {[
              { num: 1, name: 'Солнце · Сурья', desc: 'Единица. Первоисточник воли, прямое действие, авторство своей жизни.' },
              { num: 6, name: 'Венера · Шукра', desc: 'Шестёрка. Гармония, эстетическое мастерство, глубина формы и чувств.' },
              { num: 8, name: 'Сатурн · Шани', desc: 'Восьмёрка. Масштабные структуры, закон времени, терпение и весомость.' }
            ].map((arch) => (
              <div 
                key={arch.num}
                onClick={handlePantheon}
                className="p-6 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-gold)] transition-all duration-500 cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Orb number={arch.num} size={42} glow={false} />
                  <span className="font-serif text-lg text-[var(--color-text-primary)]">{arch.name}</span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] font-light leading-relaxed">
                  {arch.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Embedded Pantheon Modal */}
      <PantheonModal
        isOpen={isPantheonOpen}
        onClose={() => setIsPantheonOpen(false)}
      />

    </div>
  );
}

export default LabEntryView;
