import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { numberKnowledge } from '../data/numberKnowledge';
import { 
  COSMOLOGY_IMMERSION_CHAPTERS, 
  GRAHA_COSMOLOGY_PROFILES, 
  BIRTH_DAY_PROFILES 
} from '../data/vedicCosmology';
import { Orb } from './Orb';

interface AboutMethodProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

const METHOD_STEPS = [
  { step: '01', title: 'Древняя Традиция', desc: 'Ведическая космология (Санкхья-шастра) видит в числах 9 фундаментальных сил природы и ритмов бытия.' },
  { step: '02', title: 'Канон 5 Ключей', desc: 'Математический алгоритм вычисляет 5 осей: Душа (ядро), Выражение (форма), Путь (маршрут), Направление и Результат.' },
  { step: '03', title: 'Оттенки 31 Дня', desc: 'Раскрываются составные числа и день рождения (1–31): почему 1, 10, 19 и 28 — это разные характеры.' },
  { step: '04', title: 'Анатомия Матрицы', desc: 'Исследуются плотные опоры, свободные ячейки, роль нулей и текущий сезон жизни (Личный Год).' },
  { step: '05', title: 'Живой Синтез', desc: 'Альберт Вяземский собирает все элементы в цельный художественный портрет для личного узнавания.' },
];

export const AboutMethod: React.FC<AboutMethodProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'cosmology' | 'archetypes' | 'birthdays' | 'principles'>('cosmology');
  const [selectedArchetype, setSelectedArchetype] = useState<number>(1);
  const [selectedGroupBase, setSelectedGroupBase] = useState<number>(1);

  if (!isOpen) return null;

  const groupedDays = Object.values(BIRTH_DAY_PROFILES).filter(
    (p) => p.baseNumber === selectedGroupBase
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md transition-all duration-300"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xs shadow-2xl z-10 overflow-hidden bg-[#0B0F18] text-[var(--color-text-primary)] border border-[var(--color-border-gold)]"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[#0E1420]">
            <div>
              <span className="text-[10px] tracking-[0.3em] uppercase font-mono text-[var(--color-antique-gold)] block mb-1">
                Энциклопедия Традиции · Числа и Человек
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-light tracking-wide text-[var(--color-text-primary)]">
                Ведическая Космология и Природа Индивидуальности
              </h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xs text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer"
              title="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap border-b border-[var(--color-border-subtle)] px-6 pt-3 gap-3 sm:gap-6 text-xs font-mono tracking-wider uppercase bg-[#0B0F18]">
            {[
              { id: 'cosmology', label: '01 · Погружение в Космологию' },
              { id: 'archetypes', label: '02 · 9 Небесных Сил (Наваграха)' },
              { id: 'birthdays', label: '03 · Индивидуальность 31 Дня' },
              { id: 'principles', label: '04 · Канон и Этика' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 px-1 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'border-[var(--color-antique-gold)] text-[var(--color-antique-gold)] font-medium' 
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
            
            {/* TAB 1: COSMOLOGY IMMERSION (Понятно даже ребёнку и несведущему человеку) */}
            {activeTab === 'cosmology' && (
              <motion.div
                key="cosmology"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                <div className="p-6 sm:p-8 border border-[var(--color-border-gold)] rounded-xs bg-[#101726]/80 space-y-3">
                  <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)] block">
                    Живое введение без сложных терминов
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light">
                    Почему числа рассказывают о человеке правду?
                  </h3>
                  <p className="text-sm sm:text-base text-[var(--color-text-secondary)] font-light leading-relaxed">
                    Многие думают, что нумерология — это сухой счёт или гадание. В действительности древняя ведическая традиция (<em>Санкхья-шастра</em> — «наука о соразмерности природы») родилась из живого наблюдения за миром. Ниже — четыре простые ступени, которые объясняют всю глубину этой космологии.
                  </p>
                </div>

                {/* 4 Full Cosmology Chapters */}
                <div className="space-y-6">
                  {COSMOLOGY_IMMERSION_CHAPTERS.map((ch) => (
                    <div
                      key={ch.id}
                      className="p-6 sm:p-8 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-4"
                    >
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--color-antique-gold)] block mb-1">
                          {ch.tag}
                        </span>
                        <h4 className="font-serif text-2xl sm:text-3xl text-[var(--color-text-primary)] font-light">
                          {ch.title}
                        </h4>
                        <p className="text-xs text-[var(--color-text-muted)] font-light mt-1">
                          {ch.subtitle}
                        </p>
                      </div>

                      <div className="p-5 rounded-xs bg-[#0B0F18] border border-[var(--color-border-gold)]">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-antique-gold)] block mb-1">
                          Образное объяснение:
                        </span>
                        <p className="font-serif italic text-base sm:text-lg text-[#EAE4D7] font-light leading-relaxed">
                          «{ch.simpleAnalogy}»
                        </p>
                      </div>

                      <p className="text-sm sm:text-[15px] text-[var(--color-text-secondary)] font-light leading-relaxed">
                        {ch.deepText}
                      </p>

                      <div className="pt-3 border-t border-white/[0.06] text-xs font-mono text-[var(--color-antique-gold)]">
                        Суть: {ch.takeaway}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 5 Steps of Vyazemsky Canon */}
                <div>
                  <h4 className="text-xs uppercase tracking-[0.25em] font-mono text-[var(--color-antique-gold)] mb-4">
                    Пять ступеней чтения индивидуальности в системе «Цифровой Код»
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {METHOD_STEPS.map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-4 border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] rounded-xs flex flex-col justify-between"
                      >
                        <div>
                          <span className="font-mono text-xs text-[var(--color-antique-gold)] block mb-1">
                            {item.step}
                          </span>
                          <h5 className="font-serif text-base text-[var(--color-text-primary)] mb-2">
                            {item.title}
                          </h5>
                        </div>
                        <p className="font-sans text-xs text-[var(--color-text-secondary)] font-light leading-relaxed mt-2">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: 9 ARCHETYPES & VEDIC COSMOLOGY */}
            {activeTab === 'archetypes' && (
              <motion.div
                key="archetypes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center max-w-2xl mx-auto mb-4">
                  <span className="text-[10px] uppercase tracking-[0.25em] font-mono text-[var(--color-antique-gold)] block mb-1">
                    Девять космических клавиш бытия · Наваграха
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-light">
                    Выберите число (1–9 или 11), чтобы увидеть его космологию
                  </h3>
                </div>

                {/* Number selector grid */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 11].map((num) => {
                    const isSelected = selectedArchetype === num;
                    const cosmo = GRAHA_COSMOLOGY_PROFILES[num];
                    return (
                      <button
                        key={num}
                        onClick={() => setSelectedArchetype(num)}
                        className={`p-3 rounded-xs border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-[var(--color-antique-gold)] bg-[var(--color-antique-gold)]/15 text-[var(--color-antique-gold)]' 
                            : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-gold)]'
                        }`}
                      >
                        <span className="font-serif text-2xl font-light leading-none mb-1 tabular-nums">
                          {num}
                        </span>
                        <span className="font-mono text-[9px] tracking-wider uppercase opacity-75 truncate max-w-full">
                          {cosmo?.russianPlanet.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Archetype Cosmology Card */}
                {(() => {
                  const cosmo = GRAHA_COSMOLOGY_PROFILES[selectedArchetype] || GRAHA_COSMOLOGY_PROFILES[1];
                  const knowledge = numberKnowledge[selectedArchetype] || numberKnowledge[1];

                  return (
                    <motion.div
                      key={cosmo.number}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 sm:p-8 border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] rounded-xs space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/[0.06] gap-4">
                        <div className="flex items-center gap-4">
                          <Orb number={cosmo.number} size={64} glow={false} />
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--color-antique-gold)] block">
                              Число {cosmo.number} · {cosmo.sanskritName}
                            </span>
                            <h4 className="font-serif text-2xl sm:text-3xl font-light text-[var(--color-text-primary)]">
                              {knowledge.archetypeName} — {cosmo.poeticTitle}
                            </h4>
                            <span className="font-mono text-xs text-[var(--color-text-muted)]">
                              Стихия: {cosmo.element} · Направление: {cosmo.directionOfSpace}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Child / Simple Explanation */}
                      <div className="p-5 rounded-xs bg-[#0B0F18] border border-[var(--color-border-gold)]">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-antique-gold)] block mb-1">
                          Как объяснить это число просто и образно:
                        </span>
                        <p className="font-serif italic text-base sm:text-lg text-[#EAE4D7] font-light leading-relaxed">
                          «{cosmo.childExplanation}»
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-antique-gold)] block mb-1">
                              Первоэлемент (Таттва) и Гуна
                            </span>
                            <p className="text-[var(--color-text-secondary)] font-light leading-relaxed">
                              <strong>{cosmo.element}:</strong> {cosmo.elementMeaning} <br />
                              <strong>Гуна ({cosmo.guna}):</strong> {cosmo.gunaSimple}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-400 block mb-1">
                              Проявление в человеке и Дар
                            </span>
                            <p className="text-[var(--color-text-secondary)] font-light leading-relaxed">
                              {cosmo.humanNatureManifestation}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-amber-400 block mb-1">
                              Тень при перекосе
                            </span>
                            <p className="text-[var(--color-text-secondary)] font-light leading-relaxed">
                              {knowledge.shadow}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-purple-300 block mb-1">
                              Телесный резонанс и вопрос себе
                            </span>
                            <p className="text-[var(--color-text-secondary)] font-light leading-relaxed">
                              <strong>В теле:</strong> {cosmo.bodyResonance}
                            </p>
                            <p className="font-serif italic text-sm text-[var(--color-text-primary)] pt-1">
                              «{cosmo.lifeQuestion}»
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </motion.div>
            )}

            {/* TAB 3: INDIVIDUALITY OF 31 BIRTH DAYS */}
            {activeTab === 'birthdays' && (
              <motion.div
                key="birthdays"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="max-w-2xl mx-auto text-center space-y-2">
                  <span className="text-[10px] uppercase tracking-[0.25em] font-mono text-[var(--color-antique-gold)] block">
                    Секрет индивидуальности внутри каждого числа
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-light">
                    Чем отличаются люди одного базового числа, рождённые в разные дни (1–31)?
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] font-light">
                    Выберите группу числа Души (от 1 до 9), чтобы сравнить все дни рождения внутри этой группы.
                  </p>
                </div>

                {/* Base Number Group Selector (1-9) */}
                <div className="flex flex-wrap justify-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((base) => (
                    <button
                      key={base}
                      onClick={() => setSelectedGroupBase(base)}
                      className={`px-4 py-2 rounded-xs border text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                        selectedGroupBase === base
                          ? 'border-[var(--color-antique-gold)] bg-[var(--color-antique-gold)]/15 text-[var(--color-antique-gold)]'
                          : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-white'
                      }`}
                    >
                      Группа {base} ({Object.values(BIRTH_DAY_PROFILES).filter(p => p.baseNumber === base).map(p => p.day).join(', ')})
                    </button>
                  ))}
                </div>

                {/* Cards comparing each day in that group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedDays.map((prof) => (
                    <div
                      key={prof.day}
                      className="p-6 rounded-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                        <span className="font-serif text-3xl text-[var(--color-antique-gold)] font-light tabular-nums">
                          {prof.day}-е число
                        </span>
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                          {prof.formula}
                        </span>
                      </div>

                      <h4 className="font-serif text-xl text-[var(--color-text-primary)] font-light">
                        {prof.title}
                      </h4>

                      <p className="text-[11px] font-mono text-[var(--color-antique-gold)]/90">
                        Сплав сил: {prof.planetaryBlend}
                      </p>

                      <p className="text-xs text-[var(--color-text-secondary)] font-light leading-relaxed">
                        {prof.whyUnique}
                      </p>

                      <p className="text-xs text-[var(--color-text-secondary)] font-light leading-relaxed pt-1 border-t border-white/[0.04]">
                        <strong className="text-emerald-400 font-mono uppercase text-[10px]">В действии: </strong>
                        {prof.giftInAction}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TAB 4: PRINCIPLES & ETHICS */}
            {activeTab === 'principles' && (
              <motion.div
                key="principles"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* What it is NOT */}
                  <div className="p-6 border border-rose-500/20 bg-[var(--color-bg-surface)] rounded-xs space-y-4">
                    <div className="flex items-center gap-2.5 text-rose-400">
                      <AlertCircle className="w-5 h-5" />
                      <h4 className="font-serif text-xl font-light">Чем «Цифровой Код» НЕ является</h4>
                    </div>
                    <ul className="space-y-3 font-sans text-xs sm:text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                      <li>✕ <strong>Не гадание и не фатализм:</strong> числа описывают природный рельеф и погоду, но маршрут и поступок всегда выбирает сам человек.</li>
                      <li>✕ <strong>Не клише «всем единицам одно и то же»:</strong> каждый человек читается через пересечение 5 ключей, дня рождения (1–31), матрицы и личного года.</li>
                      <li>✕ <strong>Не медицинский диагноз:</strong> система служит самопознанию, культуре мышления и внутренней опоре.</li>
                    </ul>
                  </div>

                  {/* What it IS */}
                  <div className="p-6 border border-emerald-500/20 bg-[var(--color-bg-surface)] rounded-xs space-y-4">
                    <div className="flex items-center gap-2.5 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <h4 className="font-serif text-xl font-light">Чем «Цифровой Код» ЯВЛЯЕТСЯ</h4>
                    </div>
                    <ul className="space-y-3 font-sans text-xs sm:text-sm text-[var(--color-text-secondary)] font-light leading-relaxed">
                      <li>✓ <strong>Языком понимания своей природы:</strong> помогает перестать воевать с собой и увидеть, как устроены ваши сильные стороны.</li>
                      <li>✓ <strong>Картой внутренних противоречий:</strong> объясняет, почему внутри вас могут спорить две разные стихии и как их подружить.</li>
                      <li>✓ <strong>Точным навигационным инструментом:</strong> соединяет тысячелетнюю ведическую космологию с ясным, взрослым современным языком.</li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-[var(--color-border-subtle)] bg-[#0E1420] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-sans text-xs text-[var(--color-text-muted)] text-center sm:text-left font-light">
              «Зеркало себя» · Ведическая Космология и Природа Человека по системе Вяземского
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[var(--color-antique-gold)] text-gray-950 hover:bg-[#D9B770] transition-colors text-xs uppercase tracking-widest font-semibold rounded-xs cursor-pointer"
            >
              Вернуться к манускрипту
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
