import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Orb, PLANET_PALETTES } from './Orb';
import { PantheonModal } from './PantheonModal';
import { CalculationResult, ApiResponse } from '../types';
import { GRAHA_COSMOLOGY_PROFILES, COSMOLOGY_IMMERSION_CHAPTERS } from '../data/vedicCosmology';

interface LabEntryViewProps {
  onSelectMyth?: () => void;
  onSelectCode?: (initialDate?: string) => void;
  onSelectMeeting?: () => void;
  onOpenPantheon?: () => void;
  onOpenAbout?: () => void;
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
  onOpenAbout,
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
  const [selectedPlanet, setSelectedPlanet] = useState<number>(1);

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
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (day.length === 2 && month.length === 2 && year.length === 4 && d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2099) {
      const fullDate = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
      if (onSelectCode) {
        onSelectCode(fullDate);
      } else if (onSelectMode) {
        onSelectMode('code', fullDate);
      }
    } else {
      if (!day || !month || !year) {
        if (onSelectCode) onSelectCode();
        else if (onSelectMode) onSelectMode('code');
      } else {
        setDateError('Проверьте день, месяц и год (ДД.ММ.ГГГГ)');
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

  const activeGraha = GRAHA_COSMOLOGY_PROFILES[selectedPlanet] || GRAHA_COSMOLOGY_PROFILES[1];
  const activePalette = PLANET_PALETTES[selectedPlanet] || PLANET_PALETTES[1];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-20 sm:py-28 px-6 sm:px-10 text-[var(--color-text-primary)] font-sans relative overflow-x-hidden w-full">
      
      <div className="w-full max-w-5xl flex flex-col items-center relative z-10 my-auto text-center space-y-32 sm:space-y-44">
        
        {/* ========================================================= */}
        {/* 1. BREATHING HERO: OPEN SKY MANIFESTO                     */}
        {/* ========================================================= */}
        <motion.div 
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1 }}
          className="space-y-8 max-w-3xl mx-auto flex flex-col items-center pt-4"
        >
          <span className="text-[11px] uppercase tracking-[0.42em] text-[var(--color-antique-gold)] font-mono opacity-85">
            Космология Свободы · Природа Человека
          </span>

          <h1 className="font-serif text-5xl sm:text-7xl lg:text-[88px] text-[var(--color-text-primary)] font-light tracking-tight leading-[1.03]">
            В тебе дышит <span className="italic text-[var(--color-antique-gold)]">целый Космос</span>
          </h1>

          <p className="font-serif text-xl sm:text-2xl text-[var(--color-text-secondary)] font-light max-w-2xl mx-auto leading-[1.8] pt-2">
            Человек гораздо больше любых готовых схем. Здесь встречаются два чистых взгляда на твою природу: живая сказка твоего сегодняшнего состояния и звёздная геометрия даты рождения.
          </p>
        </motion.div>

        {/* ========================================================= */}
        {/* 2. TWO WEIGHTLESS PORTALS IN OPEN SPACE                   */}
        {/* ========================================================= */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 max-w-5xl mx-auto items-start relative">
          
          {/* Subtle vertical hairline between the two portals on desktop */}
          <div className="hidden lg:block absolute left-1/2 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent -translate-x-1/2 pointer-events-none" />

          {/* PORTAL I: PERSONAL MYTH */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            onClick={handleMyth}
            className="group flex flex-col items-center text-center cursor-pointer px-4 sm:px-8 space-y-8"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[#7CE8EE]/90">
              Орбита I · Голос Воображения
            </span>

            <div className="py-2 transition-transform duration-1000 group-hover:scale-105 animate-float-gentle">
              <Orb number={7} size={175} glow={true} />
            </div>

            <div className="space-y-4 max-w-sm">
              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Личный Миф
              </h2>

              <p className="text-[16px] text-[var(--color-text-secondary)] font-light leading-[1.85]">
                Четыре вопроса-образа в тишине. Без дат и расчётов твоё сегодняшнее ощущение мира складывается в живую притчу о твоём внутреннем ресурсе и крыльях.
              </p>
            </div>

            <div className="pt-4">
              <span className="inline-block pb-1.5 border-b border-[var(--color-antique-gold)]/40 group-hover:border-[var(--color-antique-gold)] text-[11px] uppercase tracking-[0.28em] text-[var(--color-antique-gold)] font-mono transition-all">
                {hasMyth ? 'Открыть созданную сказку →' : 'Войти через образы →'}
              </span>
            </div>
          </motion.div>

          {/* PORTAL II: DIGITAL CODE */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="group flex flex-col items-center text-center px-4 sm:px-8 space-y-8"
          >
            <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[var(--color-antique-gold)]">
              Орбита II · Музыка Первого Вдоха
            </span>

            <div className="py-2 transition-transform duration-1000 group-hover:scale-105 animate-float-gentle">
              <Orb number={1} size={175} glow={true} />
            </div>

            <div className="space-y-4 max-w-sm">
              <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                Космос Даты
              </h2>

              <p className="text-[16px] text-[var(--color-text-secondary)] font-light leading-[1.85]">
                Введи дату своего рождения. Откроется созвездие твоих пяти ключей, неповторимая мелодия дня рождения и масштаб мечты, на которую ты способен.
              </p>
            </div>

            {/* THREE WEIGHTLESS DATE FIELDS: [ ДД ] · [ ММ ] · [ ГГГГ ] */}
            <form onSubmit={handleCodeSubmit} className="w-full flex flex-col items-center space-y-7 pt-1">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                <input
                  ref={dayRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ДД"
                  maxLength={2}
                  value={day}
                  onChange={handleDayChange}
                  onKeyDown={(e) => handleKeyDown(e, 'day')}
                  className="w-14 sm:w-16 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-3xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/60 outline-none py-1.5 transition-colors tabular-nums"
                />
                <span className="text-[var(--color-antique-gold)]/60 font-serif text-2xl">·</span>
                <input
                  ref={monthRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ММ"
                  maxLength={2}
                  value={month}
                  onChange={handleMonthChange}
                  onKeyDown={(e) => handleKeyDown(e, 'month')}
                  className="w-14 sm:w-16 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-3xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/60 outline-none py-1.5 transition-colors tabular-nums"
                />
                <span className="text-[var(--color-antique-gold)]/60 font-serif text-2xl">·</span>
                <input
                  ref={yearRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ГГГГ"
                  maxLength={4}
                  value={year}
                  onChange={handleYearChange}
                  onKeyDown={(e) => handleKeyDown(e, 'year')}
                  className="w-20 sm:w-24 bg-transparent border-0 border-b border-[var(--color-border-gold)] focus:border-[var(--color-antique-gold)] text-center font-serif text-3xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/60 outline-none py-1.5 transition-colors tabular-nums"
                />
              </div>

              {dateError && (
                <span className="text-xs text-amber-300 font-light block">{dateError}</span>
              )}

              <button
                type="submit"
                className="pb-1.5 border-b border-[var(--color-antique-gold)]/50 hover:border-[var(--color-antique-gold)] text-[11px] uppercase tracking-[0.28em] text-[var(--color-antique-gold)] font-mono transition-all cursor-pointer"
              >
                {hasCode ? 'Вернуться к звёздному атласу →' : 'Раскрыть созвездие даты →'}
              </button>
            </form>
          </motion.div>

        </div>

        {/* ========================================================= */}
        {/* 3. HARMONY OF THE 9 CELESTIAL LIGHTS (NO HEAVY BOXES)      */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35 }}
          className="w-full max-w-4xl pt-20 border-t border-white/[0.08] flex flex-col items-center text-center space-y-12"
        >
          <div className="space-y-3 max-w-2xl">
            <span className="text-[10px] uppercase font-mono tracking-[0.38em] text-[#7CE8EE]">
              Девять Светил Наваграха · Живой Планетарий
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-text-primary)] font-light">
              Девять лучей, из которых соткана природа человека
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)] font-light leading-relaxed">
              Прикоснитесь к любому числу, чтобы почувствовать его стихию, услышать простой образ и увидеть, какую мечту оно пробуждает.
            </p>
          </div>

          {/* Minimalist Star Selector Line */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const p = PLANET_PALETTES[num];
              const isSelected = selectedPlanet === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelectedPlanet(num)}
                  className={`w-11 h-11 rounded-full font-serif text-xl transition-all duration-500 flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'scale-115 text-white border'
                      : 'text-[var(--color-text-muted)] hover:text-white border border-transparent'
                  }`}
                  style={
                    isSelected
                      ? {
                          borderColor: p.color,
                          boxShadow: `0 0 28px ${p.glow}`,
                          background: 'rgba(255,255,255,0.04)',
                        }
                      : undefined
                  }
                >
                  {num}
                </button>
              );
            })}
          </div>

          {/* Harmonious Flowing Story of the Selected Star */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedPlanet}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-3xl flex flex-col items-center space-y-8 pt-2"
            >
              <Orb number={selectedPlanet} size={160} glow={true} />

              <div className="space-y-3">
                <span
                  className="text-[11px] font-mono uppercase tracking-[0.3em] block"
                  style={{ color: activePalette.color }}
                >
                  Луч {selectedPlanet} · {activeGraha.sanskritName} · {activeGraha.element}
                </span>

                <h3 className="font-serif text-3xl sm:text-5xl text-[var(--color-text-primary)] font-light">
                  {activeGraha.poeticTitle}
                </h3>
              </div>

              <p className="font-serif italic text-xl sm:text-2xl text-[#EAE4D7] leading-[1.8] font-light max-w-2xl">
                «{activeGraha.childExplanation}»
              </p>

              <p className="text-base sm:text-[17px] text-[var(--color-text-secondary)] font-light leading-[1.9] max-w-2xl">
                {activeGraha.humanNatureManifestation} В теле и движении этот луч откликается как {activeGraha.bodyResonance.toLowerCase()}
              </p>

              <div className="pt-4 space-y-4">
                <p className="font-serif italic text-lg text-[var(--color-antique-gold)] font-light">
                  Горизонт мечты: «{activeGraha.lifeQuestion}»
                </p>

                <button
                  type="button"
                  onClick={handlePantheon}
                  className="text-[11px] uppercase font-mono tracking-[0.25em] text-[var(--color-text-muted)] hover:text-[var(--color-antique-gold)] transition-colors cursor-pointer"
                >
                  Открыть полный пантеон девяти сил →
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ========================================================= */}
        {/* 4. MEETING OF MIRRORS & COSMOLOGY INVITATION              */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45 }}
          className="w-full max-w-4xl pt-20 border-t border-white/[0.08] space-y-24"
        >
          {/* Meeting of Mirrors — Open, Breathable Invitation */}
          <div
            onClick={handleMeeting}
            className="group flex flex-col items-center text-center space-y-6 cursor-pointer max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-center -space-x-4 mb-2">
              <Orb number={codeResult?.soul || 1} size={64} glow={true} />
              <Orb number={7} size={64} glow={true} />
            </div>

            <span className="text-[10px] uppercase font-mono tracking-[0.35em] text-[var(--color-antique-gold)]">
              {isMeetingReady ? 'Оба отражения готовы к встрече' : 'Третье пространство · Гармония двух зеркал'}
            </span>

            <h3 className="font-serif text-3xl sm:text-5xl text-[var(--color-text-primary)] font-light">
              Встреча Зеркал
            </h3>

            <p className="text-base text-[var(--color-text-secondary)] font-light leading-[1.85]">
              Когда соединяются вечный чертёж вашей даты рождения и живая сказка сегодняшнего дня, возникает удивительная объёмность: вы видите и свои глубокие корни, и то, куда тянутся ветви вашей мечты сейчас.
            </p>

            <span className="inline-block pb-1 border-b border-[var(--color-antique-gold)]/40 group-hover:border-[var(--color-antique-gold)] text-[11px] uppercase tracking-[0.28em] text-[var(--color-antique-gold)] font-mono transition-all">
              {isMeetingReady ? 'Соединить оба созвездия →' : 'Перейти к пространству встречи →'}
            </span>
          </div>

          {/* Flowing 2-Column Editorial Introduction to Vedic Cosmology */}
          <div className="pt-16 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-16 text-left">
            {COSMOLOGY_IMMERSION_CHAPTERS.slice(0, 2).map((ch) => (
              <div
                key={ch.id}
                onClick={onOpenAbout}
                className="group cursor-pointer space-y-4"
              >
                <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--color-antique-gold)] block">
                  {ch.tag}
                </span>
                <h4 className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light group-hover:text-[var(--color-antique-gold)] transition-colors">
                  {ch.title}
                </h4>
                <p className="font-serif italic text-base sm:text-lg text-[#EAE4D7] font-light leading-[1.75]">
                  «{ch.simpleAnalogy}»
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] font-light leading-[1.85]">
                  {ch.deepText}
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
