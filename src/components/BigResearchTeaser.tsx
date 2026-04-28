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
      className="w-full max-w-4xl mx-auto my-16 bg-[var(--color-ink)] text-[var(--color-ivory)] relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/white-diamond-dark.png")' }}></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-50"></div>
      
      <div className="p-12 md:p-20 relative z-10 flex flex-col items-center border border-[var(--border-soft)] border-opacity-20">
        <h2 className="font-serif text-4xl md:text-5xl mb-4 text-center tracking-wide">Большое исследование</h2>
        <p className="font-sans text-xs tracking-[0.25em] uppercase text-[var(--color-antique-gold)] mb-8 text-center bg-[var(--color-ink)] px-4">
          ПОЛНЫЙ ПЕРСОНАЛЬНЫЙ ДОКУМЕНТ
        </p>
        
        <p className="font-serif text-[1.1rem] md:text-xl text-center leading-relaxed text-[var(--color-muted)] max-w-2xl mb-12 italic">
          Глубокий разбор вашей матрицы. Мы описываем не только отдельные числа, но и связи между ними: внутренние опоры, спрятанные конфликты, денежный и творческий потенциал.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl mb-16 text-left">
          <div className="space-y-6">
            <div>
              <h4 className="font-sans text-[0.7rem] tracking-widest uppercase text-[var(--color-antique-gold)] mb-2">Глава I</h4>
              <h3 className="font-serif text-xl border-b border-gray-700 pb-2">Ядро и Сила</h3>
              <p className="font-sans text-sm text-gray-400 mt-2">Детальный анализ чисел Души, Пути, Направления, Выражения и Результата. Сложные составные энергии и ключи к ним.</p>
            </div>
            <div>
              <h4 className="font-sans text-[0.7rem] tracking-widest uppercase text-[var(--color-antique-gold)] mb-2">Глава II</h4>
              <h3 className="font-serif text-xl border-b border-gray-700 pb-2">Матрица в деталях</h3>
              <p className="font-sans text-sm text-gray-400 mt-2">Линии, диагонали, нули и перегрузы. Как балансировать дефицит энергии и не сгореть от ее избытка.</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h4 className="font-sans text-[0.7rem] tracking-widest uppercase text-[var(--color-antique-gold)] mb-2">Глава III</h4>
              <h3 className="font-serif text-xl border-b border-gray-700 pb-2">Деньги и Циклы</h3>
              <p className="font-sans text-sm text-gray-400 mt-2">Анализ денежного кода и определение вашего текущего Личного Года. Стратегия действий на текущий цикл.</p>
            </div>
            <div>
              <h4 className="font-sans text-[0.7rem] tracking-widest uppercase text-[var(--color-antique-gold)] mb-2">Глава IV</h4>
              <h3 className="font-serif text-xl border-b border-gray-700 pb-2">Синтез</h3>
              <p className="font-sans text-sm text-gray-400 mt-2">Как все элементы работают вместе. Главные точки напряжения и практические шаги для гармонизации.</p>
            </div>
          </div>
        </div>

        <MeanderDivider />

        <button 
          onClick={onCtaClick}
          className="mt-8 px-10 py-5 bg-[var(--color-antique-gold)] text-[var(--color-ivory)] hover:bg-[#8A6327] transition-colors font-sans text-xs tracking-widest uppercase shadow-lg shadow-black/20"
        >
          Получить Большое исследование
        </button>
        <p className="text-[10px] text-gray-500 font-sans tracking-widest uppercase mt-6">
          Закрытый премиальный продукт
        </p>
      </div>
    </motion.div>
  );
};
