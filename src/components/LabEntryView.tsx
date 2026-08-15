import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  GitFork,
  Sliders,
  ShieldCheck,
  Grid
} from 'lucide-react';
import { CalculationResult, ApiResponse } from '../types';
import { Orb } from './Orb';
import { PantheonModal } from './PantheonModal';

interface LabEntryViewProps {
  codeResult: CalculationResult | null;
  storyResult: ApiResponse['story_result'] | null;
  onSelectMode: (mode: 'code' | 'myth' | 'meeting' | 'ab-test') => void;
}

export function LabEntryView({
  codeResult,
  storyResult,
  onSelectMode
}: LabEntryViewProps) {
  const [isPantheonOpen, setIsPantheonOpen] = useState(false);
  const [pantheonInitNum, setPantheonInitNum] = useState(1);

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult;
  const hasBoth = hasCode && hasMyth;

  const handleOpenPantheon = (num: number = 1) => {
    setPantheonInitNum(num);
    setIsPantheonOpen(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] px-4 sm:px-6 py-12 text-[#EAEAEA] relative overflow-hidden bg-[#090D15]">
      
      {/* Quiet Ambient Backdrops */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(200,164,93,0.06)_0%,transparent_70%)] pointer-events-none blur-2xl" />

      <div className="w-full max-w-5xl flex flex-col items-center text-center relative z-10 my-auto">
        
        {/* Subtle Top Marker */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)]/80" />
          <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-antique-gold)]/90 font-light">
            Интерактивное зеркало человека
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)]/80" />
        </motion.div>

        {/* Monumental Title: Cormorant Garamond */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1 }}
          className="font-serif text-[42px] sm:text-[68px] lg:text-[80px] text-[#F4F4F4] mb-4 tracking-tight font-normal leading-[1.08] max-w-4xl"
        >
          Зеркало себя
        </motion.h1>

        {/* Subtitle: Manrope 300 */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="text-base sm:text-lg lg:text-[19px] text-[#C9C0AE] max-w-2xl mb-14 leading-relaxed font-light tracking-wide"
        >
          Есть разные способы посмотреть на себя. Начните с того, который сейчас ближе.
        </motion.p>

        {/* TWO DOORS IN SILENCE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full mb-12">
          
          {/* DOOR 1: PERSONAL MYTH */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            onClick={() => onSelectMode('myth')}
            className="group relative bg-[#0D121D]/90 border border-white/10 hover:border-[var(--color-antique-gold)]/40 p-8 sm:p-10 rounded-xs text-left cursor-pointer flex flex-col justify-between transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] tracking-[0.25em] uppercase text-purple-300/80 font-mono">
                  Линза I · Образы
                </span>
                {hasMyth && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-light">
                    <CheckCircle2 size={14} /> Создан
                  </span>
                )}
              </div>

              {/* Glowing Orb Center */}
              <div className="flex items-center gap-5 mb-6">
                <Orb number={7} size="md" glow={true} />
                <div>
                  <h2 className="font-serif text-3xl sm:text-4xl text-white group-hover:text-[var(--color-antique-gold)] transition-colors duration-300 font-normal">
                    Личный Миф
                  </h2>
                  <span className="text-xs text-gray-400 font-light tracking-wider">
                    Сказка про вас
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-8 font-light">
                4 образных вопроса. История, рождающаяся из ваших собственных символов и внутреннего движения.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 flex items-center justify-between text-xs text-[var(--color-antique-gold)] font-medium tracking-[0.2em] uppercase">
              <span>{hasMyth ? 'Открыть готовую сказку' : 'Войти через образы'}</span>
              <ArrowRight size={15} className="group-hover:translate-x-1.5 transition-transform duration-300" />
            </div>
          </motion.div>

          {/* DOOR 2: DIGITAL CODE */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            onClick={() => onSelectMode('code')}
            className="group relative bg-[#0D121D]/90 border border-white/10 hover:border-[var(--color-antique-gold)]/40 p-8 sm:p-10 rounded-xs text-left cursor-pointer flex flex-col justify-between transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-antique-gold)]/80 font-mono">
                  Линза II · Дата
                </span>
                {hasCode && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-light">
                    <CheckCircle2 size={14} /> Рассчитан
                  </span>
                )}
              </div>

              {/* Glowing Orb Center */}
              <div className="flex items-center gap-5 mb-6">
                <Orb number={1} size="md" glow={true} />
                <div>
                  <h2 className="font-serif text-3xl sm:text-4xl text-white group-hover:text-[var(--color-antique-gold)] transition-colors duration-300 font-normal">
                    Цифровой Код
                  </h2>
                  <span className="text-xs text-gray-400 font-light tracking-wider">
                    Пять ключей природы
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-8 font-light">
                Только дата рождения. Пять ключей и символическая карта вашей внутренней архитектуры.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 flex items-center justify-between text-xs text-[var(--color-antique-gold)] font-medium tracking-[0.2em] uppercase">
              <span>{hasCode ? 'Открыть паспорт кода' : 'Войти через дату'}</span>
              <ArrowRight size={15} className="group-hover:translate-x-1.5 transition-transform duration-300" />
            </div>
          </motion.div>

        </div>

        {/* PANTHEON TEASER (3 REFINED CARDS) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="w-full bg-[#0B0F18]/80 border border-white/5 p-6 sm:p-8 rounded-xs mb-8 flex flex-col md:flex-row items-center justify-between gap-6 text-left"
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            
            {/* 3 Archetype Mini-Cards */}
            <div className="flex items-center gap-3">
              {[
                { num: 1, label: 'Солнце' },
                { num: 6, label: 'Венера' },
                { num: 8, label: 'Сатурн' }
              ].map((item) => (
                <button
                  key={item.num}
                  onClick={() => handleOpenPantheon(item.num)}
                  className="flex flex-col items-center p-2.5 rounded-xs bg-[#121824] border border-white/5 hover:border-[var(--color-antique-gold)]/40 transition-all group"
                  title={`Архетип: ${item.label}`}
                >
                  <Orb number={item.num} size="xs" glow={false} />
                  <span className="text-[10px] text-gray-400 group-hover:text-[var(--color-antique-gold)] mt-1 font-light">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <h3 className="font-serif text-lg sm:text-xl text-white font-normal">
                Пантеон девяти архетипов
              </h3>
              <p className="text-xs text-gray-400 font-light leading-relaxed">
                Атлас девяти сил: солнечные новаторы, венерианские мастера гармонии, сатурнианские хранители закона.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenPantheon(1)}
            className="px-5 py-2.5 rounded-xs border border-[var(--color-antique-gold)]/30 hover:border-[var(--color-antique-gold)] text-[11px] text-[var(--color-antique-gold)] uppercase tracking-[0.2em] font-medium transition-all hover:bg-[var(--color-antique-gold)]/10 shrink-0 flex items-center gap-2"
          >
            <Grid size={13} />
            <span>Все 9 архетипов</span>
          </button>
        </motion.div>

        {/* MEETING OF MIRRORS SYNTHESIS CARD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          onClick={() => onSelectMode('meeting')}
          className={`w-full p-6 sm:p-8 rounded-xs border transition-all cursor-pointer text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${
            hasBoth
              ? 'bg-[#101827] border-[var(--color-antique-gold)]/50 shadow-[0_0_40px_rgba(200,164,93,0.12)]'
              : 'bg-[#0B0F18]/50 border-white/5 hover:border-white/15'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#141C2B] border border-[var(--color-antique-gold)]/30 flex items-center justify-center shrink-0 text-[var(--color-antique-gold)]">
              <GitFork size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)]">
                  Синтез · Встреча двух зеркал
                </span>
                {hasBoth && (
                  <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-2 py-0.5 rounded-full">
                    Доступен
                  </span>
                )}
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-[#F4F4F4] mb-1 font-normal">
                Встреча Зеркал
              </h3>
              <p className="text-xs text-gray-400 max-w-xl leading-relaxed font-light">
                Сопоставление двух независимых отражений: где структура вашей даты согласуется с вашими метафорами, а где зеркала расходятся.
              </p>
            </div>
          </div>

          <button
            className={`px-5 py-2.5 uppercase tracking-[0.2em] text-[11px] font-medium rounded-xs transition-all shrink-0 flex items-center gap-2 ${
              hasBoth
                ? 'bg-[var(--color-antique-gold)] text-gray-950 hover:bg-[#D9B770]'
                : 'border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <span>{hasBoth ? 'Открыть синтез' : 'Обзор встречи'}</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>

        {/* Quiet Footer Metadata */}
        <div className="mt-12 pt-6 border-t border-white/5 w-full flex flex-wrap justify-between items-center text-xs text-gray-500 gap-4">
          <div className="flex items-center gap-2 font-light">
            <ShieldCheck size={14} className="text-[var(--color-antique-gold)]/80" />
            <span>Обе линзы формируются строго независимо</span>
          </div>

          <button
            onClick={() => onSelectMode('ab-test')}
            className="text-gray-500 hover:text-[var(--color-antique-gold)] flex items-center gap-1.5 transition-colors text-xs font-light tracking-wide"
          >
            <Sliders size={13} />
            <span>Лаборатория моделей</span>
          </button>
        </div>

      </div>

      {/* Pantheon Modal */}
      <PantheonModal 
        isOpen={isPantheonOpen}
        onClose={() => setIsPantheonOpen(false)}
        initialSelectedNumber={pantheonInitNum}
      />
    </div>
  );
}
