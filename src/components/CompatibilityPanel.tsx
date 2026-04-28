import React from 'react';
import { motion } from 'motion/react';
import { ApiResponse } from '../types';

interface CompatibilityPanelProps {
  data: NonNullable<ApiResponse['compatibility_result']>;
}

export function CompatibilityPanel({ data }: CompatibilityPanelProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full max-w-4xl bg-[var(--color-surface)] border border-[var(--border-soft)] p-8 md:p-12 text-[var(--color-ink)]"
    >
      <div className="text-center mb-10">
        <h2 className="font-serif text-3xl md:text-4xl text-[var(--color-ink)] mb-4">
          Танец двух путей
        </h2>
        <div className="w-16 h-px bg-[var(--color-antique-gold)] mx-auto opacity-50"></div>
      </div>

      <div className="space-y-10 font-serif leading-relaxed text-lg">
        {/* Введение */}
        <div className="p-6 bg-[var(--color-warm-paper)] border border-[var(--border-soft)]">
          <p className="whitespace-pre-line text-[var(--color-graphite)]">
            {data.introduction}
          </p>
        </div>

        {/* Краткая карта */}
        <div>
          <h3 className="font-sans text-xs tracking-[0.2em] uppercase text-[var(--color-muted)] mb-4 pb-2 border-b border-[var(--border-soft)]">Кратко</h3>
          <p className="whitespace-pre-line">{data.cards_summary}</p>
        </div>

        {/* 5 Уровней */}
        <div className="space-y-8 mt-12 relative before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-[var(--border-soft)]">
          {[
            { id: '1', title: 'Душа ↔ Душа', text: data.levels.soul_to_soul },
            { id: '2', title: 'Путь ↔ Путь', text: data.levels.path_to_path },
            { id: '3', title: 'Перекрестная динамика', text: data.levels.cross_dynamic },
            { id: '4', title: 'Наложение матриц', text: data.levels.matrix_overlay },
            { id: '5', title: 'Синхронность циклов', text: data.levels.cycles_sync }
          ].map((level) => (
             <div key={level.id} className="relative pl-12">
               <div className="absolute left-[11px] top-1.5 w-2 h-2 rounded-full bg-[var(--color-antique-gold)] border-2 border-[var(--color-surface)]"></div>
               <h4 className="font-sans text-xs tracking-widest uppercase text-[var(--color-muted)] mb-2">{level.title}</h4>
               <p className="text-[var(--color-ink)] leading-relaxed">{level.text}</p>
             </div>
          ))}
        </div>

        {/* Сила и Напряжение */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="p-6 bg-[var(--color-marble)] border border-[var(--border-soft)] relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-antique-gold)] opacity-30"></div>
             <h4 className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-[var(--color-muted)] mb-3">Точка силы</h4>
             <p className="text-[0.95rem]">{data.strength_point}</p>
          </div>
          <div className="p-6 bg-[var(--color-marble)] border border-[var(--border-soft)] relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-red-900/10"></div>
             <h4 className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-[var(--color-muted)] mb-3">Точка напряжения</h4>
             <p className="text-[0.95rem]">{data.tension_point}</p>
          </div>
        </div>

        {/* Практика */}
        <div className="mt-12 p-8 border border-[var(--color-antique-gold)] border-opacity-30 flex flex-col items-center text-center">
          <h4 className="font-sans text-xs tracking-[0.2em] uppercase text-[var(--color-antique-gold)] mb-4">Напутствие для пары</h4>
          <p className="italic text-[var(--color-graphite)] max-w-2xl">{data.practice_or_parable}</p>
        </div>
      </div>
    </motion.div>
  );
}
