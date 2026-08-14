import React from 'react';
import { motion } from 'motion/react';
import { CalculationResult } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { Sparkles, Shield, Eye } from 'lucide-react';

interface SymbolicPortraitProps {
  calc: CalculationResult;
}

const ELEMENT_COLORS: Record<number, { primary: string; secondary: string; glow: string; element: string }> = {
  1: { primary: '#D97706', secondary: '#F59E0B', glow: 'rgba(217, 119, 6, 0.25)', element: 'Огонь Солнца' },
  2: { primary: '#60A5FA', secondary: '#93C5FD', glow: 'rgba(96, 165, 250, 0.25)', element: 'Вода Луны' },
  3: { primary: '#C084FC', secondary: '#E9D5FF', glow: 'rgba(192, 132, 252, 0.25)', element: 'Эфир Юпитера' },
  4: { primary: '#64748B', secondary: '#94A3B8', glow: 'rgba(100, 116, 139, 0.25)', element: 'Тень Раху' },
  5: { primary: '#10B981', secondary: '#6EE7B7', glow: 'rgba(16, 185, 129, 0.25)', element: 'Земля Меркурия' },
  6: { primary: '#F472B6', secondary: '#FBCFE8', glow: 'rgba(244, 114, 182, 0.25)', element: 'Вода Венеры' },
  7: { primary: '#818CF8', secondary: '#C7D2FE', glow: 'rgba(129, 140, 248, 0.25)', element: 'Мистика Кету' },
  8: { primary: '#78716C', secondary: '#A8A29E', glow: 'rgba(120, 113, 108, 0.25)', element: 'Воздух Сатурна' },
  9: { primary: '#EF4444', secondary: '#FCA5A5', glow: 'rgba(239, 68, 68, 0.25)', element: 'Пламя Марса' }
};

export const SymbolicPortrait: React.FC<SymbolicPortraitProps> = ({ calc }) => {
  const soulNum = calc.soul;
  const pathNum = calc.path;
  const dirNum = calc.direction;

  const soulColor = ELEMENT_COLORS[soulNum] || ELEMENT_COLORS[1];
  const pathColor = ELEMENT_COLORS[pathNum] || ELEMENT_COLORS[8];
  const dirColor = ELEMENT_COLORS[dirNum] || ELEMENT_COLORS[5];

  const soulInfo = numberKnowledge[soulNum];
  const pathInfo = numberKnowledge[pathNum];

  return (
    <div className="w-full bg-[#121815] text-[#EAEAEA] border border-[#2A3B33] p-6 sm:p-10 rounded-sm relative overflow-hidden shadow-2xl my-10">
      {/* Background radial gradients */}
      <div 
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: soulColor.glow }}
      />
      <div 
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: pathColor.glow }}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
        {/* Left / Center: Sacred Geometry Visual Canvas */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center shrink-0">
          {/* Outer rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-dashed border-[#A3B8AD]/30"
          />

          {/* Secondary counter-rotating ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-4 rounded-full border border-dotted border-[var(--color-antique-gold)]/40"
          />

          {/* Central Layered Symbolic Shape */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Soul Polygon */}
            <motion.div
              animate={{ rotate: [0, 90, 180, 270, 360] }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-2 border-2 border-opacity-60 rounded-xl"
              style={{ borderColor: soulColor.primary, boxShadow: `0 0 25px ${soulColor.glow}` }}
            />

            {/* Path Polygon */}
            <motion.div
              animate={{ rotate: [360, 270, 180, 90, 0] }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-5 border border-opacity-70 rotate-45 rounded-lg"
              style={{ borderColor: pathColor.secondary, boxShadow: `0 0 20px ${pathColor.glow}` }}
            />

            {/* Direction Core */}
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-full flex flex-col items-center justify-center border border-[var(--color-antique-gold)] bg-black/60 backdrop-blur-md z-10 shadow-lg"
            >
              <span className="font-serif text-2xl font-bold text-[var(--color-antique-gold)]">
                {soulNum}·{pathNum}
              </span>
              <span className="text-[8px] uppercase tracking-widest text-[#A3B8AD]">
                Синтез
              </span>
            </motion.div>
          </div>

          {/* Floating Archetype Tags */}
          <div className="absolute top-0 right-2 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest bg-black/70 border border-[#2A3B33] text-[#A3B8AD]">
            {soulColor.element}
          </div>
          <div className="absolute bottom-0 left-2 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest bg-black/70 border border-[#2A3B33] text-[#A3B8AD]">
            {pathColor.element}
          </div>
        </div>

        {/* Right: Narrative Description of the Portrait */}
        <div className="flex-1 space-y-4 text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-antique-gold)]" />
            <span className="text-[10px] tracking-[0.25em] uppercase font-sans text-[var(--color-antique-gold)]">
              Символический Портрет Формулы
            </span>
          </div>

          <h3 className="font-serif text-2xl sm:text-3xl text-white font-normal">
            Союз {soulInfo?.planet.split(' ')[0]} и {pathInfo?.planet.split(' ')[0]}
          </h3>

          <p className="font-serif italic text-sm text-[#D1D5DB] leading-relaxed">
            «В этом портрете сплетаются импульс {soulInfo?.luxuryName.toLowerCase() || 'начала'} и русло {pathInfo?.luxuryName.toLowerCase() || 'пути'}. Формула соединяет стихии {soulColor.element.split(' ')[0]} и {pathColor.element.split(' ')[0]}, формируя уникальный узор проявления в мире.»
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-[#16201C] border border-[#2A3B33] rounded-sm">
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-antique-gold)] block mb-1">
                Главенствующий мотив
              </span>
              <span className="font-sans text-xs text-[#EAEAEA]">
                {soulInfo?.gift || 'Индивидуальная сила самовыражения'}
              </span>
            </div>

            <div className="p-3 bg-[#16201C] border border-[#2A3B33] rounded-sm">
              <span className="text-[10px] uppercase tracking-widest text-[#A3B8AD] block mb-1">
                Среда реализации
              </span>
              <span className="font-sans text-xs text-[#EAEAEA]">
                {pathInfo?.task || 'Осознанное следование выбранному маршруту'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
