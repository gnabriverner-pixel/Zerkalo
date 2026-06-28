import React from 'react';
import { motion } from 'motion/react';

interface Props {
  onCtaClick: () => void;
}

const MeanderDivider = () => (
  <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto my-8 opacity-40">
    <path d="M0 6H10V1H20V11H30V6H40V1H50V11H60V6H70V1H80V11H90V6H100V1H110V11H120" stroke="var(--color-antique-gold)" strokeWidth="0.5" strokeMiterlimit="10"/>
  </svg>
);

export const BigResearchTeaser: React.FC<Props> = ({ onCtaClick }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto my-16 bg-[var(--color-ink)] text-[var(--color-ivory)] relative overflow-hidden shadow-2xl"
    >
      <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at center, rgba(163, 184, 173, 0.15) 0%, transparent 70%), linear-gradient(135deg, rgba(16, 26, 22, 0.8) 0%, rgba(20, 25, 22, 0.9) 100%)' }}></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-50"></div>
      
      <div className="p-12 md:p-20 relative z-10 flex flex-col items-center border border-[var(--border-soft)] border-opacity-20">
        <h2 className="font-serif text-4xl md:text-5xl mb-4 text-center tracking-wide">Большое исследование</h2>
        <p className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-antique-gold)] mb-8 text-center bg-[var(--color-ink)] px-4">
          ПОЛНЫЙ ПЕРСОНАЛЬНЫЙ ДОКУМЕНТ
        </p>
        
        <p className="font-serif text-[1.15rem] md:text-xl text-center leading-relaxed text-[var(--color-muted)] max-w-2xl mb-16 italic">
          Глубокий разбор формулы личности. Мы описываем не только базовые числа, но и сложную архитектуру матрицы: внутренние опоры, точки напряжения, деньги и реализацию.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-3xl mb-16 text-left">
          <div className="space-y-8">
            <div>
              <h4 className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-[var(--color-antique-gold)] mb-3">Глава I</h4>
              <h3 className="font-serif text-2xl border-b border-gray-700 pb-3 mb-3 text-[var(--color-ivory)]">Ядро и Сила</h3>
              <p className="font-sans text-sm text-gray-400 leading-relaxed">Детальный анализ чисел Души, Пути, Направления, Выражения и Результата. Сильные стороны, составные числа и ключи к ним.</p>
            </div>
            <div>
              <h4 className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-[var(--color-antique-gold)] mb-3">Глава II</h4>
              <h3 className="font-serif text-2xl border-b border-gray-700 pb-3 mb-3 text-[var(--color-ivory)]">Матрица архитектуры</h3>
              <p className="font-sans text-sm text-gray-400 leading-relaxed">Матрица ресурсов и задач. Линии, диагонали, нули и перегрузы. Как балансировать дефицит опоры и управлять избытком силы.</p>
            </div>
          </div>
          <div className="space-y-8">
            <div>
              <h4 className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-[var(--color-antique-gold)] mb-3">Глава III</h4>
              <h3 className="font-serif text-2xl border-b border-gray-700 pb-3 mb-3 text-[var(--color-ivory)]">Циклы и Реализация</h3>
              <p className="font-sans text-sm text-gray-400 leading-relaxed">Деньги и реализация, ваш Личный год и отношения. Стратегия действий, опирающаяся на текущий временной цикл.</p>
            </div>
            <div>
              <h4 className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-[var(--color-antique-gold)] mb-3">Глава IV</h4>
              <h3 className="font-serif text-2xl border-b border-gray-700 pb-3 mb-3 text-[var(--color-ivory)]">Синтез</h3>
              <p className="font-sans text-sm text-gray-400 leading-relaxed">Как все элементы работают вместе. Главные точки напряжения и практический маршрут для движения вперёд.</p>
            </div>
          </div>
        </div>

        <MeanderDivider />

        <button 
          onClick={onCtaClick}
          className="mt-6 px-12 py-5 bg-[var(--color-antique-gold)] text-[var(--color-ink)] hover:bg-[#b08833] transition-all font-sans text-[0.65rem] tracking-[0.25em] uppercase shadow-lg hover:shadow-xl hover:-translate-y-px"
        >
          Обратиться к Эксперту
        </button>
        <p className="text-[0.65rem] text-gray-500 font-sans tracking-[0.2em] uppercase mt-6 opacity-80">
          Расчёт, собранный в живое слово.
        </p>
      </div>
    </motion.div>
  );
};
