import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Compass, Shield, Eye, Zap } from 'lucide-react';
import { Orb, PLANET_PALETTES } from './Orb';
import { numberKnowledge } from '../data/numberKnowledge';
import { PASSPORT_PRACTICES } from '../data/passportPractices';

interface PantheonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedNumber?: number;
}

export function PantheonModal({ isOpen, onClose, initialSelectedNumber = 1 }: PantheonModalProps) {
  const [selectedNum, setSelectedNum] = useState<number>(initialSelectedNumber);

  if (!isOpen) return null;

  const currentInfo = numberKnowledge[selectedNum] || numberKnowledge[1];
  const currentPractice = PASSPORT_PRACTICES[selectedNum];
  const orbCfg = PLANET_PALETTES[selectedNum] || PLANET_PALETTES[1];

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#070A10]/85 backdrop-blur-xl overflow-y-auto"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.96, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative w-full max-w-5xl bg-[#0D121D] border border-[var(--color-antique-gold)]/30 rounded-xs shadow-[0_24px_80px_rgba(0,0,0,0.8)] text-[#EAEAEA] p-6 sm:p-10 my-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b border-white/[0.08] mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] text-[10px] tracking-widest uppercase mb-2">
                <Sparkles size={11} />
                <span>Пантеон девяти архетипов</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-4xl text-stone-100 font-light tracking-wide">
                Девять Ключей Природы
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 max-w-xl mt-1 font-light">
                Каждое число несет в себе целостную архитектуру: планетарный архетип, врожденный дар, теневую ловушку и практический ключ интеграции.
              </p>
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 rounded-full text-stone-400 hover:text-stone-100 hover:bg-white/10 transition-colors shrink-0"
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>
          </div>

          {/* Number Selector Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 sm:gap-3 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const isSelected = selectedNum === num;
              const info = numberKnowledge[num];
              return (
                <button
                  key={num}
                  onClick={() => setSelectedNum(num)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xs border transition-all duration-300 relative group cursor-pointer ${
                    isSelected
                      ? 'bg-[#182030] border-[var(--color-antique-gold)] shadow-[0_0_20px_rgba(200,164,93,0.25)]'
                      : 'bg-[#101622]/80 border-white/[0.06] hover:border-white/20 hover:bg-[#141C2B]'
                  }`}
                >
                  <Orb number={num} size="xs" glow={isSelected} />
                  <span className={`text-[11px] mt-2 font-medium tracking-wide ${isSelected ? 'text-[var(--color-antique-gold)]' : 'text-stone-400 group-hover:text-stone-200'}`}>
                    {info?.planet.split(' ')[0]}
                  </span>
                  <span className="text-[9px] text-stone-500 font-mono">
                    #{num}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detail Card for Selected Archetype */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-[#090D15]/80 p-6 sm:p-8 rounded-xs border border-white/[0.08]">
            
            {/* Left: Orb & Title */}
            <div className="lg:col-span-4 flex flex-col items-center text-center lg:border-r lg:border-white/[0.08] lg:pr-8">
              <Orb number={selectedNum} size="xl" glow={true} className="mb-6" />
              
              <span className="text-xs uppercase tracking-widest text-[var(--color-antique-gold)] font-mono mb-1">
                {orbCfg.sanskrit} · {currentInfo.planet}
              </span>
              
              <h3 className="font-serif text-3xl text-stone-100 mb-2 font-light">
                {currentInfo.archetypeName}
              </h3>
              
              <p className="text-xs text-stone-400 leading-relaxed max-w-xs mb-6 font-light">
                {currentInfo.core}
              </p>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {currentInfo.keywords?.map((kw, i) => (
                  <span key={i} className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-stone-300 font-mono">
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Architecture & Practices */}
            <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
              
              {/* Gift vs Shadow */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xs bg-[#121927] border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs uppercase tracking-wider font-semibold mb-2">
                    <Zap size={14} />
                    <span>Врожденный Дар</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-light">
                    {currentInfo.gift}
                  </p>
                </div>

                <div className="p-4 rounded-xs bg-[#121927] border border-amber-500/20">
                  <div className="flex items-center gap-2 text-amber-400 text-xs uppercase tracking-wider font-semibold mb-2">
                    <Shield size={14} />
                    <span>Теневая Ловушка</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-light">
                    {currentInfo.shadow}
                  </p>
                </div>
              </div>

              {/* Triptych of Practices */}
              {currentPractice && (
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400 font-mono block">
                    Триптих практик архетипа
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xs bg-[#0F1624] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-xs text-[#A3B8AD] font-semibold mb-1.5">
                        <Eye size={13} />
                        <span>Наблюдение</span>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed font-light">
                        {currentPractice.observation.insight}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xs bg-[#0F1624] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-antique-gold)] font-semibold mb-1.5">
                        <Zap size={13} />
                        <span>Действие</span>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed font-light">
                        {currentPractice.action.microStep}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xs bg-[#0F1624] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold mb-1.5">
                        <Sparkles size={13} />
                        <span>Интеграция</span>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed italic font-light">
                        «{currentPractice.integration.focusMantra}»
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Practical Key */}
              <div className="p-3.5 rounded-xs bg-[var(--color-antique-gold)]/10 border border-[var(--color-antique-gold)]/30 flex items-start gap-3">
                <Compass size={18} className="text-[var(--color-antique-gold)] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-antique-gold)] font-semibold block mb-0.5">
                    Ключ к балансу
                  </span>
                  <p className="text-xs text-stone-300 leading-relaxed font-light">
                    {currentInfo.practicalKey}
                  </p>
                </div>
              </div>

            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
