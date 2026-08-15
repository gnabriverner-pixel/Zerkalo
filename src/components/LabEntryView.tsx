import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, GitFork } from 'lucide-react';
import { Orb } from './Orb';
import { PantheonModal } from './PantheonModal';
import { CalculationResult, ApiResponse } from '../types';

interface LabEntryViewProps {
  onSelectMyth?: () => void;
  onSelectCode?: () => void;
  onSelectMeeting?: () => void;
  onOpenPantheon?: () => void;
  onSelectMode?: (mode: 'entry' | 'code' | 'myth' | 'meeting' | 'ab-test') => void;
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
  const [isPantheonOpen, setIsPantheonOpen] = useState(false);

  const hasCode = hasCodeResult !== undefined ? hasCodeResult : !!codeResult;
  const hasMyth = hasMythResult !== undefined ? hasMythResult : !!storyResult;
  const isMeetingReady = hasCode && hasMyth;

  const handleMyth = () => {
    if (onSelectMyth) onSelectMyth();
    else if (onSelectMode) onSelectMode('myth');
  };

  const handleCode = () => {
    if (onSelectCode) onSelectCode();
    else if (onSelectMode) onSelectMode('code');
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] py-12 px-4 sm:px-6 lg:px-8 text-[#EAEAEA] font-sans relative overflow-x-hidden w-full selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      
      {/* Central Content */}
      <div className="w-full max-w-5xl flex flex-col items-center relative z-10 my-auto text-center space-y-16">
        
        {/* ========================================================= */}
        {/* 1. MONUMENTAL HEADER */}
        {/* ========================================================= */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="space-y-4 max-w-3xl mx-auto"
        >
          <span className="text-[11px] uppercase tracking-[0.35em] text-[var(--color-antique-gold)] font-mono block">
            Интерактивное зеркало человека
          </span>

          <h1 className="font-serif text-5xl sm:text-7xl lg:text-8xl text-stone-100 font-light tracking-tight leading-[1.05]">
            Зеркало себя
          </h1>

          <p className="text-stone-300/80 font-light text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed pt-2">
            Два независимых пути к пониманию собственной природы. Войдите через образы живого состояния или через математический код даты.
          </p>
        </motion.div>

        {/* ========================================================= */}
        {/* 2. THE TWO DOORS IN SILENCE */}
        {/* ========================================================= */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          
          {/* DOOR 1: PERSONAL MYTH */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            onClick={handleMyth}
            className="group relative flex flex-col items-center justify-between p-8 sm:p-10 rounded-xs bg-[#0D121D]/60 backdrop-blur-md border border-white/[0.08] hover:border-[#C8A45D]/40 transition-all duration-700 cursor-pointer text-center"
          >
            <div className="flex flex-col items-center w-full">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-purple-300/70 mb-6">
                Линза I · Личный Миф
              </span>

              <div className="my-2 transition-transform duration-700 group-hover:scale-105">
                <Orb number={7} size="lg" glow={true} />
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl text-stone-100 font-light mt-6 mb-3">
                Сказка про вас
              </h2>

              <p className="text-sm text-stone-300/70 font-light leading-relaxed max-w-xs mb-8">
                Четыре образных вопроса. Внутреннее напряжение превращается в живой персональный миф.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono group-hover:translate-x-1 transition-transform">
              <span>{hasMyth ? 'Открыть созданную сказку' : 'Войти через образы'}</span>
              <ArrowRight size={14} />
            </div>
          </motion.div>

          {/* DOOR 2: DIGITAL CODE */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            onClick={handleCode}
            className="group relative flex flex-col items-center justify-between p-8 sm:p-10 rounded-xs bg-[#0D121D]/60 backdrop-blur-md border border-white/[0.08] hover:border-[#C8A45D]/40 transition-all duration-700 cursor-pointer text-center"
          >
            <div className="flex flex-col items-center w-full">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)]/80 mb-6">
                Линза II · Цифровой Код
              </span>

              <div className="my-2 transition-transform duration-700 group-hover:scale-105">
                <Orb number={1} size="lg" glow={true} />
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl text-stone-100 font-light mt-6 mb-3">
                Архитектура природы
              </h2>

              <p className="text-sm text-stone-300/70 font-light leading-relaxed max-w-xs mb-8">
                Пять математических ключей по дате рождения и пошаговый ритуал раскрытия карты.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono group-hover:translate-x-1 transition-transform">
              <span>{hasCode ? 'Открыть карту кода' : 'Рассчитать свой код'}</span>
              <ArrowRight size={14} />
            </div>
          </motion.div>

        </div>

        {/* ========================================================= */}
        {/* 3. SYNTHESIS BANNER (MEETING OF MIRRORS) */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          onClick={handleMeeting}
          className={`w-full max-w-4xl p-6 sm:p-8 rounded-xs border transition-all duration-500 flex flex-col sm:flex-row items-center justify-between gap-6 ${
            isMeetingReady
              ? 'bg-[#0D121D]/80 border-[var(--color-antique-gold)]/40 shadow-[0_0_30px_rgba(200,164,93,0.12)] cursor-pointer hover:border-[var(--color-antique-gold)]'
              : 'bg-[#0D121D]/40 border-white/[0.06] cursor-pointer hover:border-white/15'
          }`}
        >
          <div className="flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 text-[var(--color-antique-gold)]">
              <GitFork size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl text-stone-100 font-normal">
                  Встреча Зеркал
                </span>
                {isMeetingReady && (
                  <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-[var(--color-antique-gold)]/15 border border-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)]">
                    Готово к синтезу
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-300/70 font-light mt-1">
                Сопоставление двух независимых отражений: поиск параллелей, расхождений и синтез-вопрос.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono whitespace-nowrap">
            <span>{isMeetingReady ? 'Провести синтез' : 'Узнать больше'}</span>
            <ArrowRight size={14} />
          </div>
        </motion.div>

        {/* ========================================================= */}
        {/* 4. PANTHEON TEASER */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="w-full max-w-4xl pt-6 border-t border-white/[0.06] flex flex-col items-center"
        >
          <div className="flex items-center justify-between w-full mb-6">
            <div className="text-left">
              <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--color-antique-gold)]/80 block mb-1">
                Канон Вяземского
              </span>
              <h3 className="font-serif text-2xl text-stone-100 font-light">
                Пантеон девяти архетипов
              </h3>
            </div>

            <button
              onClick={handlePantheon}
              className="text-xs uppercase font-mono tracking-wider text-[var(--color-antique-gold)] hover:underline flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Смотреть все девять</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
            {[
              { num: 1, name: 'Солнце · Сурья', desc: 'Единица. Первоисточник воли, прямое действие, авторство своей жизни.' },
              { num: 6, name: 'Венера · Шукра', desc: 'Шестёрка. Гармония, эстетическое мастерство, глубина формы и чувств.' },
              { num: 8, name: 'Сатурн · Шани', desc: 'Восьмёрка. Масштабные структуры, закон времени, терпение и весомость.' }
            ].map((arch) => (
              <div 
                key={arch.num}
                onClick={handlePantheon}
                className="p-5 rounded-xs bg-[#0D121D]/50 border border-white/[0.06] hover:border-white/20 transition-all duration-500 cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Orb number={arch.num} size="sm" glow={false} />
                  <span className="font-serif text-lg text-stone-200">{arch.name}</span>
                </div>
                <p className="text-xs text-stone-400 font-light leading-relaxed">
                  {arch.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Embedded Pantheon Modal if triggered internally */}
      <PantheonModal
        isOpen={isPantheonOpen}
        onClose={() => setIsPantheonOpen(false)}
      />

    </div>
  );
}

export default LabEntryView;
