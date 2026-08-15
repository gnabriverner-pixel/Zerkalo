import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  GitFork, 
  ArrowRight, 
  CheckCircle2, 
  Compass,
  Feather,
  Layers,
  ShieldCheck,
  Sliders,
  Eye,
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] px-4 sm:px-6 py-12 text-[#EAEAEA] relative overflow-hidden bg-cosmic-mesh">
      
      {/* Background Ambient Orbs */}
      <div className="absolute top-20 -left-24 w-96 h-96 bg-[var(--color-antique-gold)]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -right-24 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl flex flex-col items-center text-center relative z-10">
        
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#121824] border border-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] text-[11px] tracking-widest uppercase mb-6 shadow-sm"
        >
          <Sparkles size={12} className="text-[var(--color-antique-gold)]" />
          <span>Интерактивное зеркало человека</span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-serif text-4xl sm:text-6xl lg:text-7xl text-[#F4F4F4] mb-4 tracking-tight font-normal max-w-3xl leading-tight"
        >
          Зеркало себя
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-2xl mb-12 leading-relaxed font-light"
        >
          Есть разные способы посмотреть на себя. Начните с того, который сейчас ближе.
        </motion.p>

        {/* TWO EQUAL DOORS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-10">
          
          {/* DOOR 1: PERSONAL MYTH */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => onSelectMode('myth')}
            className="group relative glass-card glass-card-hover p-8 sm:p-10 rounded-xs text-left cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient Corner Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-500" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-mono tracking-widest uppercase text-purple-300 bg-purple-950/40 px-3 py-1 rounded-xs border border-purple-500/30 flex items-center gap-1.5">
                  <Feather size={12} />
                  <span>Линза 1 · Символы и состояние</span>
                </span>
                {hasMyth && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 size={15} /> Создан
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-4">
                <Orb number={7} size="sm" glow={true} />
                <div>
                  <h2 className="font-serif text-2xl sm:text-3xl text-white group-hover:text-[var(--color-antique-gold)] transition-colors">
                    Личный Миф
                  </h2>
                  <span className="text-xs text-gray-400 font-mono tracking-wider uppercase">
                    Сказка про тебя
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6 font-light">
                Четыре образных вопроса. Никакой даты рождения — только персональная художественная история, рождающаяся строго из ваших символов и внутреннего движения.
              </p>
            </div>

            <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs text-[var(--color-antique-gold)] font-medium tracking-wider uppercase">
              <span>{hasMyth ? 'Открыть готовую сказку' : 'Войти в личный миф'}</span>
              <ArrowRight size={15} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </motion.div>

          {/* DOOR 2: DIGITAL CODE */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => onSelectMode('code')}
            className="group relative glass-card glass-card-hover p-8 sm:p-10 rounded-xs text-left cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient Corner Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--color-antique-gold)] bg-amber-950/40 px-3 py-1 rounded-xs border border-amber-500/30 flex items-center gap-1.5">
                  <Compass size={12} />
                  <span>Линза 2 · Числа и архетипы</span>
                </span>
                {hasCode && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 size={15} /> Рассчитан
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-4">
                <Orb number={1} size="sm" glow={true} />
                <div>
                  <h2 className="font-serif text-2xl sm:text-3xl text-white group-hover:text-[var(--color-antique-gold)] transition-colors">
                    Цифровой Код
                  </h2>
                  <span className="text-xs text-gray-400 font-mono tracking-wider uppercase">
                    5 ключей природы
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6 font-light">
                Только дата рождения. Детерминированный расчет пяти ключевых позиций (Душа, Выражение, Путь, Направление, Результат) и триптих практик.
              </p>
            </div>

            <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs text-[var(--color-antique-gold)] font-medium tracking-wider uppercase">
              <span>{hasCode ? 'Открыть паспорт кода' : 'Рассчитать свой код'}</span>
              <ArrowRight size={15} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </motion.div>

        </div>

        {/* PANTHEON TEASER */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="w-full glass-card p-6 rounded-xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 border-white/10"
        >
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="flex items-center -space-x-3">
              <Orb number={1} size="xs" glow={false} />
              <Orb number={3} size="xs" glow={false} />
              <Orb number={5} size="xs" glow={false} />
            </div>
            <div>
              <h3 className="font-serif text-lg text-white font-medium">
                Пантеон девяти архетипов
              </h3>
              <p className="text-xs text-gray-400 font-light">
                Исследуйте полный атлас планетарных энергий, их даров и практических ключей.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenPantheon(1)}
            className="px-4 py-2.5 rounded-xs border border-[var(--color-antique-gold)]/40 hover:border-[var(--color-antique-gold)] text-xs text-[var(--color-antique-gold)] uppercase tracking-wider font-semibold transition-all flex items-center gap-2 hover:bg-[var(--color-antique-gold)]/10 shrink-0"
          >
            <Grid size={13} />
            <span>Открыть все 9 архетипов</span>
          </button>
        </motion.div>

        {/* MEETING OF MIRRORS BANNER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={() => onSelectMode('meeting')}
          className={`w-full p-6 sm:p-8 rounded-xs border transition-all cursor-pointer text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${
            hasBoth
              ? 'bg-[#131D2A] border-[var(--color-antique-gold)]/60 shadow-[0_0_30px_rgba(200,164,93,0.15)]'
              : 'glass-card border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A2536] border border-[var(--color-antique-gold)]/30 flex items-center justify-center shrink-0 text-[var(--color-antique-gold)]">
              <GitFork size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-antique-gold)]">
                  Синтез · Смысловой мост
                </span>
                {hasBoth && (
                  <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-2 py-0.5 rounded-full">
                    Готово к встрече
                  </span>
                )}
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-[#F4F4F4] mb-1">
                Встреча Зеркал
              </h3>
              <p className="text-xs text-gray-400 max-w-xl leading-relaxed font-light">
                Сопоставление двух независимых отражений: где структура вашей даты согласуется с вашими метафорами, а где зеркала расходятся.
              </p>
            </div>
          </div>

          <button
            className={`px-6 py-3 uppercase tracking-widest text-xs font-semibold rounded-xs transition-all shrink-0 flex items-center gap-2 ${
              hasBoth
                ? 'bg-[var(--color-antique-gold)] text-gray-950 hover:bg-[#D9B770] shadow-md'
                : 'border border-white/15 text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{hasBoth ? 'Провести синтез' : 'Обзор встречи'}</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>

        {/* FOOTER BAR */}
        <div className="mt-10 pt-6 border-t border-white/5 w-full flex flex-wrap justify-between items-center text-xs text-gray-500 gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--color-antique-gold)]" />
            <span>Обе линзы формируются строго независимо</span>
          </div>

          <button
            onClick={() => onSelectMode('ab-test')}
            className="text-gray-500 hover:text-[var(--color-antique-gold)] flex items-center gap-1.5 transition-colors"
          >
            <Sliders size={13} />
            <span>Лаборатория моделей (A/B тест)</span>
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
