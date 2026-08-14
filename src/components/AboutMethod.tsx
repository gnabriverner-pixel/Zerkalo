import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Compass, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle, 
  Layers, 
  Eye, 
  Scale, 
  Flame, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Sun,
  Moon,
  BookOpen
} from 'lucide-react';
import { numberKnowledge } from '../data/numberKnowledge';

interface AboutMethodProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

const PLANETARY_ARCHETYPES = [
  { num: 1, planet: 'Солнце (Сурья)', title: 'Новатор и Создатель', essence: 'Воля, автономность, импульс начала, авторство решений', shadow: 'Эгоцентризм, страх потери статуса, давление на окружающих', element: 'Огонь / Центр' },
  { num: 2, planet: 'Луна (Чандра)', title: 'Дипломат и Хранитель Связи', essence: 'Эмпатия, восприимчивость, гибкость, интуитивное понимание другого', shadow: 'Размытие границ, эмоциональная зависимость, нерешительность', element: 'Вода / Отражение' },
  { num: 3, planet: 'Юпитер (Гуру)', title: 'Учитель и Наставник', essence: 'Мудрость, масштабное мышление, системность, передача знаний', shadow: 'Менторский тон, догматизм, недооценка чувственной сферы', element: 'Эфир / Знание' },
  { num: 4, planet: 'Раху (Северный Узел)', title: 'Реформатор и Стратег', essence: 'Прорыв за рамки шаблонов, нестандартное видение, масштабные цели', shadow: 'Иллюзии, внутренняя неудовлетворенность, бунт ради бунта', element: 'Воздух / Тень' },
  { num: 5, planet: 'Меркурий (Будха)', title: 'Коммуникатор и Интегратор', essence: 'Адаптивность, скорость мышления, легкость связей, торговля, словесность', shadow: 'Поверхностность, распыление сил, импульсивность', element: 'Земля / Движение' },
  { num: 6, planet: 'Венера (Шукра)', title: 'Мастер Гармонии и Формы', essence: 'Эстетика, вкус, чувственность, созидание комфорта и ценности через качество', shadow: 'Гедонизм, манипуляции обаянием, зависимость от внешнего блеска', element: 'Вода / Красота' },
  { num: 7, planet: 'Кету (Южный Узел)', title: 'Исследователь Глубины', essence: 'Глубокий анализ, проницательность, внутренняя тишина, поиск скрытых смыслов', shadow: 'Самоизоляция, подозрительность, обесценивание материального', element: 'Огонь / Мистика' },
  { num: 8, planet: 'Сатурн (Шани)', title: 'Архитектор и Хранитель Закона', essence: 'Дисциплина, терпение, структурное мышление, справедливость, управление временем', shadow: 'Чрезмерная суровость, ригидность, гиперответственность', element: 'Воздух / Порядок' },
  { num: 9, planet: 'Марс (Мангал)', title: 'Защитник и Проводник Энергии', essence: 'Динамика, смелость, служение благородной цели, бескорыстная отдача', shadow: 'Вспыльчивость, нетерпение, склонность к конфликтам на пустом месте', element: 'Огонь / Действие' }
];

const METHOD_STEPS = [
  { step: '01', title: 'Традиция', desc: 'Ведическая традиция сопоставляет числовые циклы с девятью архетипическими силами (грахами).' },
  { step: '02', title: 'Точный Расчет', desc: 'Математический алгоритм вычисляет пять главных узлов: Душа, Путь, Направление, Выражение, Итог.' },
  { step: '03', title: 'Интерпретация', desc: 'Анализ взаимодействия архетипов — где рождается синергия, а где возникает естественное трение.' },
  { step: '04', title: 'Гипотеза', desc: 'Система формирует гипотезу о ведущих механизмах вашего характера и векторах реализации.' },
  { step: '05', title: 'Личное Узнавание', desc: 'Вы сопоставляете карту со своим опытом. Финальный смысл и решение всегда остаются за вами.' },
];

export const AboutMethod: React.FC<AboutMethodProps> = ({ isOpen, onClose, theme = 'light' }) => {
  const [activeTab, setActiveTab] = useState<'essence' | 'archetypes' | 'principles' | 'faq'>('essence');
  const [selectedArchetype, setSelectedArchetype] = useState<number>(1);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md transition-all duration-300"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-sm shadow-2xl z-10 overflow-hidden border ${
            isDark 
              ? 'bg-[#0F1412] text-[#EAEAEA] border-[#2A3B33]' 
              : 'bg-[#FCFAF6] text-[#1A1A1A] border-[#E8DFC8]'
          }`}
        >
          {/* Top Decorative Border Accent */}
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-80" />

          {/* Header */}
          <div className={`p-6 sm:p-8 flex items-center justify-between border-b ${
            isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                isDark 
                  ? 'border-[#A3B8AD]/30 bg-[#1A2621] text-[var(--color-antique-gold)]' 
                  : 'border-[var(--color-antique-gold)]/40 bg-white text-[var(--color-antique-gold)] shadow-sm'
              }`}>
                <Compass className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <span className={`text-[10px] tracking-[0.25em] uppercase font-sans ${
                  isDark ? 'text-[#A3B8AD]' : 'text-[var(--color-antique-gold)]'
                }`}>
                  Концепция & Архитектура Знания
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-normal tracking-wide">
                  О методе «Цифровой Код»
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${
                isDark 
                  ? 'text-[#A3B8AD] hover:text-white hover:bg-[#1A2621]' 
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
              title="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className={`flex flex-wrap border-b px-6 pt-3 gap-2 sm:gap-6 text-xs sm:text-sm font-sans tracking-wider uppercase ${
            isDark ? 'border-[#2A3B33] bg-[#0F1412]' : 'border-[#EAE3D2] bg-[#FCFAF6]'
          }`}>
            {[
              { id: 'essence', label: 'Суть и природа', icon: Sparkles },
              { id: 'archetypes', label: '9 Архетипов', icon: Sun },
              { id: 'principles', label: 'Исследование vs Гадание', icon: Scale },
              { id: 'faq', label: 'Вопросы и ответы', icon: HelpCircle }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 px-1 flex items-center gap-2 border-b-2 font-medium transition-all ${
                    isActive 
                      ? 'border-[var(--color-antique-gold)] text-[var(--color-antique-gold)]' 
                      : isDark
                        ? 'border-transparent text-[#7B8F85] hover:text-[#A3B8AD]'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
            {/* TAB 1: ESSENCE */}
            {activeTab === 'essence' && (
              <motion.div
                key="essence"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Manifesto Box */}
                <div className={`p-6 sm:p-8 border rounded-sm ${
                  isDark ? 'bg-[#141C18] border-[#2A3B33]' : 'bg-[#F6F2E9] border-[#E5DEC9]'
                }`}>
                  <h3 className="font-serif text-xl sm:text-2xl mb-4 text-[var(--color-antique-gold)]">
                    Символический язык, а не фатализм
                  </h3>
                  <p className="font-sans text-sm sm:text-base leading-relaxed opacity-90 mb-4">
                    Ведическая нумерология (система <em>Санкхья Шастра</em>) рассматривает числа даты рождения как универсальный символический алфавит. Каждому числу соответствует один из девяти планетарных архетипов индийской космологии — каждый со своим набором качеств, векторов силы, психологических теней и способов проявления.
                  </p>
                  <p className="font-sans text-sm sm:text-base leading-relaxed opacity-90">
                    Мы не прячем происхождение метода за общими абстрактными словами, но придерживаемся строгой <strong>интеллектуальной честности</strong>: мы не утверждаем непроверяемых мистических постулатов о «лучах планет». Мы используем эту тысячелетнюю традицию как точную образно-символическую призму для глубокого самоисследования.
                  </p>
                </div>

                {/* 5 Steps Process */}
                <div>
                  <h4 className="text-xs uppercase tracking-[0.2em] font-sans mb-4 opacity-70">
                    Драматургия метода: от традиции к личному опыту
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    {METHOD_STEPS.map((item, idx) => (
                      <div 
                        key={idx}
                        className={`p-4 border rounded-sm flex flex-col justify-between ${
                          isDark ? 'bg-[#111A16] border-[#2A3B33]' : 'bg-white border-[#EAE3D2] shadow-xs'
                        }`}
                      >
                        <div>
                          <span className="font-serif text-xs text-[var(--color-antique-gold)] block mb-1">
                            {item.step}
                          </span>
                          <h5 className="font-serif text-sm font-semibold mb-2">
                            {item.title}
                          </h5>
                        </div>
                        <p className="font-sans text-xs leading-relaxed opacity-80 mt-2">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Why Date of Birth */}
                <div className={`p-6 border rounded-sm ${
                  isDark ? 'bg-[#141C18] border-[#2A3B33]' : 'bg-white border-[#E8DFC8]'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-[var(--color-antique-gold)]/10 text-[var(--color-antique-gold)] mt-1 shrink-0">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-serif text-lg font-medium">
                        Почему исследование начинается с даты рождения?
                      </h4>
                      <p className="font-sans text-sm leading-relaxed opacity-85">
                        В обычных психологических тестах человек сначала отвечает на сотню наводящих вопросов, неосознанно рисуя желаемый образ себя. Дата рождения даёт строго фиксированную формулу: система делает ход первой — без наводящих вопросов рассчитывает символический рисунок. А вы проверяете, насколько точно эта гипотеза откликается в вашей реальной жизни.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Compound numbers nuance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-5 border rounded-sm ${
                    isDark ? 'bg-[#111A16] border-[#2A3B33]' : 'bg-[#FBF9F5] border-[#E8DFC8]'
                  }`}>
                    <h5 className="font-serif text-base mb-2 text-[var(--color-antique-gold)] flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Составные числа
                    </h5>
                    <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-80">
                      Итоговая цифра <strong>8</strong>, полученная из 17 (1+7), 26 (2+6) или 35 (3+5), звучит совершенно по-разному. Составные числа показывают путь формирования энергии и скрытые мотивы, раскрывая настоящую глубину формулы.
                    </p>
                  </div>

                  <div className={`p-5 border rounded-sm ${
                    isDark ? 'bg-[#111A16] border-[#2A3B33]' : 'bg-[#FBF9F5] border-[#E8DFC8]'
                  }`}>
                    <h5 className="font-serif text-base mb-2 text-[var(--color-antique-gold)] flex items-center gap-2">
                      <Flame className="w-4 h-4" /> Внутренние противоречия
                    </h5>
                    <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-80">
                      Система не дает «хороших» или «плохих» оценок. Она подсвечивает места внутреннего трения — например, когда потребность Души в покое и гармонии спорит с требованием Пути к жесткому структурированию и контролю.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: 9 ARCHETYPES */}
            {activeTab === 'archetypes' && (
              <motion.div
                key="archetypes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center max-w-xl mx-auto mb-6">
                  <span className="text-xs uppercase tracking-[0.2em] font-sans opacity-70 block mb-1">
                    Планетарные силы традиции
                  </span>
                  <h3 className="font-serif text-2xl">
                    Девять Числовых Архетипов
                  </h3>
                  <p className="font-sans text-xs sm:text-sm opacity-80 mt-2">
                    Каждое число несет законченную мифологическую роль, светлое проявление, зону тени и способ взаимодействия с миром.
                  </p>
                </div>

                {/* Number selector grid */}
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                  {PLANETARY_ARCHETYPES.map((arch) => {
                    const isSelected = selectedArchetype === arch.num;
                    return (
                      <button
                        key={arch.num}
                        onClick={() => setSelectedArchetype(arch.num)}
                        className={`p-3 rounded-sm border flex flex-col items-center justify-center transition-all ${
                          isSelected 
                            ? 'border-[var(--color-antique-gold)] bg-[var(--color-antique-gold)]/15 scale-105 shadow-md' 
                            : isDark
                              ? 'border-[#2A3B33] bg-[#141C18] hover:border-[#A3B8AD]/50'
                              : 'border-[#EAE3D2] bg-white hover:border-[var(--color-antique-gold)]/50'
                        }`}
                      >
                        <span className="font-serif text-2xl font-semibold leading-none mb-1">
                          {arch.num}
                        </span>
                        <span className="font-sans text-[10px] tracking-wider uppercase opacity-70 truncate max-w-full">
                          {arch.planet.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Archetype Card */}
                {(() => {
                  const current = PLANETARY_ARCHETYPES.find(a => a.num === selectedArchetype) || PLANETARY_ARCHETYPES[0];
                  const knowledge = numberKnowledge[current.num];

                  return (
                    <motion.div
                      key={current.num}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-6 sm:p-8 border rounded-sm ${
                        isDark ? 'bg-[#141C18] border-[#2A3B33]' : 'bg-white border-[#E8DFC8] shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-inherit gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-serif text-4xl text-[var(--color-antique-gold)]">
                              {current.num}
                            </span>
                            <div>
                              <h4 className="font-serif text-xl sm:text-2xl font-medium">
                                {current.title}
                              </h4>
                              <span className="font-sans text-xs tracking-wider uppercase opacity-70 block">
                                Планетарная сила: {current.planet} • {current.element}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-1.5 rounded-full border border-[var(--color-antique-gold)]/30 text-xs font-sans tracking-widest uppercase text-[var(--color-antique-gold)] self-start sm:self-auto">
                          {knowledge?.luxuryName || 'Основание Кода'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="space-y-4">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-antique-gold)] block mb-1">
                              Светлая сторона & Ядро силы
                            </span>
                            <p className="font-sans text-sm leading-relaxed opacity-90">
                              {current.essence}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                              Дар и Ресурс
                            </span>
                            <p className="font-sans text-sm leading-relaxed opacity-90">
                              {knowledge?.gift || 'Способность удерживать баланс и созидать форму.'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400 block mb-1">
                              Зона напряжения & Тень
                            </span>
                            <p className="font-sans text-sm leading-relaxed opacity-90">
                              {current.shadow}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-sky-700 dark:text-sky-300 block mb-1">
                              Практический вектор развития
                            </span>
                            <p className="font-sans text-sm leading-relaxed opacity-90">
                              {knowledge?.task || 'Осознанная интеграция сильных сторон без соскальзывания в крайности.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {knowledge?.keywords && (
                        <div className="mt-6 pt-4 border-t border-inherit flex flex-wrap gap-2">
                          <span className="text-xs uppercase tracking-wider opacity-60 self-center mr-2">
                            Ключи:
                          </span>
                          {knowledge.keywords.map((kw, i) => (
                            <span 
                              key={i} 
                              className={`text-[11px] px-2.5 py-1 rounded-sm border ${
                                isDark ? 'bg-[#111A16] border-[#2A3B33]' : 'bg-[#FAF8F5] border-[#E8DFC8]'
                              }`}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })()}
              </motion.div>
            )}

            {/* TAB 3: PRINCIPLES & ETHICS */}
            {activeTab === 'principles' && (
              <motion.div
                key="principles"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Contrast Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* What it is NOT */}
                  <div className={`p-6 border rounded-sm space-y-4 ${
                    isDark ? 'bg-[#1A1515] border-rose-900/40' : 'bg-rose-50/50 border-rose-200'
                  }`}>
                    <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-5 h-5" />
                      <h4 className="font-serif text-lg font-medium">Чем «Цифровой Код» НЕ является</h4>
                    </div>
                    <ul className="space-y-3 font-sans text-xs sm:text-sm leading-relaxed opacity-90">
                      <li className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold shrink-0">✕</span>
                        <span><strong>Не гадание и не предсказание будущего:</strong> здесь нет фаталистических пророчеств или жестко предопределенных дат событий.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold shrink-0">✕</span>
                        <span><strong>Не медицинский или психиатрический диагноз:</strong> разбор не заменяет работу с врачом или психотерапевтом.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold shrink-0">✕</span>
                        <span><strong>Не индульгенция для пассивности:</strong> фразы вроде «я ничего не делаю, потому что у меня такое число» противоречат сути метода.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold shrink-0">✕</span>
                        <span><strong>Не эзотерическая догма:</strong> мы не требуем слепой веры в астрологические постулаты.</span>
                      </li>
                    </ul>
                  </div>

                  {/* What it IS */}
                  <div className={`p-6 border rounded-sm space-y-4 ${
                    isDark ? 'bg-[#141C18] border-emerald-900/40' : 'bg-emerald-50/50 border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <h4 className="font-serif text-lg font-medium">Чем «Цифровой Код» ЯВЛЯЕТСЯ</h4>
                    </div>
                    <ul className="space-y-3 font-sans text-xs sm:text-sm leading-relaxed opacity-90">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                        <span><strong>Символическим языком саморефлексии:</strong> упорядочивает понимание внутренних импульсов, привычек и реакций.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                        <span><strong>Картой внутренних противоречий:</strong> объясняет, почему в одном человеке могут одновременно уживаться противоположные потребности.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                        <span><strong>Оптикой для поиска вектора:</strong> предлагает смелые и ясные гипотезы о сфере естественного применения ваших талантов.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓</span>
                        <span><strong>Пространством диалога:</strong> помогает задать себе честные и глубокие вопросы о природе собственного характера.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Ethics Charter */}
                <div className={`p-6 border rounded-sm ${
                  isDark ? 'bg-[#141C18] border-[#2A3B33]' : 'bg-white border-[#E8DFC8]'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="w-6 h-6 text-[var(--color-antique-gold)]" />
                    <h4 className="font-serif text-xl">Кодекс уважения к человеку</h4>
                  </div>
                  <p className="font-sans text-sm leading-relaxed opacity-85 mb-4">
                    Каждый человек шире любой типологии. Цифровой код — это не железная клетка, а зеркало и маршрутная карта. Мы исходим из того, что развитие личности заключается не в подчинении цифрам, а в осознанном управлении своими природными энергиями и свободе выбора.
                  </p>
                  <div className="border-l-2 border-[var(--color-antique-gold)] pl-4 italic font-serif text-sm opacity-90">
                    «Традиция дает координаты, но путь выбирает путник».
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: FAQ */}
            {activeTab === 'faq' && (
              <motion.div
                key="faq"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {[
                  {
                    q: 'Что делать, если описание не совпадает со мной на 100%?',
                    a: 'Это абсолютно естественно. Карта показывает базовую природную архитектуру и потенциалы. Если какая-то грань не откликается, возможно, этот архетип сейчас вытеснен средой, воспитанием или вы проживаете противоположный полюс. Используйте это как точку для исследования: «Почему эта часть сейчас спит?»'
                  },
                  {
                    q: 'У людей, рожденных в один день, одинаковая судьба?',
                    a: 'Нет. Одинакова лишь символическая «палитра красок». То, какую картину человек напишет этими красками, зависит от семьи, воспитания, личных выборов, уровня осознанности и воли. Кроме того, на человека влияют имя, город и составные числа.'
                  },
                  {
                    q: 'Как рассчитываются пять главных чисел?',
                    a: '1. Число Души (день рождения) — глубинное самоощущение. 2. Число Пути (сумма всей даты) — глобальный маршрут. 3. Число Направления — сфера максимальной отдачи. 4. Число Выражения (день + месяц) — манера действия. 5. Число Итога — зрелая форма синтеза.'
                  },
                  {
                    q: 'Кто такой Альберт Вяземский?',
                    a: 'Альберт — проводник и исследователь цифрового кода. Он помогает перевести математическую формулу даты рождения на ясный, живой и образный русский язык, связывая архетипы с реальными вызовами человека.'
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-5 border rounded-sm ${
                      isDark ? 'bg-[#141C18] border-[#2A3B33]' : 'bg-white border-[#EAE3D2]'
                    }`}
                  >
                    <h5 className="font-serif text-base font-medium mb-2 text-[var(--color-antique-gold)]">
                      {item.q}
                    </h5>
                    <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-85">
                      {item.a}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 sm:p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
          }`}>
            <span className="font-sans text-xs opacity-70 text-center sm:text-left">
              «Зеркало себя» • Интеллектуальное самоисследование через ведическую традицию
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[var(--color-antique-gold)] text-white hover:bg-[#B8934C] transition-colors text-xs uppercase tracking-widest font-sans rounded-sm"
            >
              Вернуться к зеркалу
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
