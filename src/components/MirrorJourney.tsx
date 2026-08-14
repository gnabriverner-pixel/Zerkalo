import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalculationResult, FirstMirror } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { SymbolicPortrait } from './SymbolicPortrait';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Compass, 
  Layers, 
  Eye, 
  Flame, 
  ShieldAlert, 
  ExternalLink,
  MessageCircle,
  HelpCircle,
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface MirrorJourneyProps {
  calc: CalculationResult;
  reading?: FirstMirror | null;
  onViewFullMap: () => void;
  onOpenAlbertChat?: (promptTopic?: string) => void;
  onOpenAbout?: () => void;
}

export const MirrorJourney: React.FC<MirrorJourneyProps> = ({
  calc,
  reading,
  onViewFullMap,
  onOpenAlbertChat,
  onOpenAbout
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 7;

  // Scroll to top of journey component on step change
  useEffect(() => {
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }, [currentStep]);

  const soul = calc.soul;
  const soulComposite = calc.soulComposite;
  const path = calc.path;
  const pathComposite = calc.pathComposite;
  const direction = calc.direction;
  const directionComposite = calc.directionComposite;
  const expression = calc.expression;
  const expressionComposite = calc.expressionComposite;
  const resultNum = calc.result;
  const resultComposite = calc.resultComposite;

  const soulInfo = numberKnowledge[soul] || numberKnowledge[1];
  const pathInfo = numberKnowledge[path] || numberKnowledge[8];
  const dirInfo = numberKnowledge[direction] || numberKnowledge[5];
  const exprInfo = numberKnowledge[expression] || numberKnowledge[6];
  const resInfo = numberKnowledge[resultNum] || numberKnowledge[1];

  // Helper for synthesis insight (Soul vs Path dynamic)
  const getSynthesisDynamic = (s: number, p: number) => {
    if (s === p) {
      return {
        title: 'Усиленный импульс одного начала',
        desc: `И ваша внутренняя сущность, и ваш глобальный путь направляются одной силой (${soulInfo.planet.split(' ')[0]}). Это дает колоссальную концентрацию и верность своей природе, однако требует сознательного развития недостающих стихий.`
      };
    }
    return {
      title: `Встреча ${soulInfo.planet.split(' ')[0]} и ${pathInfo.planet.split(' ')[0]}`,
      desc: `Одна часть вашей формулы (${soulInfo.planet.split(' ')[0]}) стремится к ${soulInfo.gift.toLowerCase()}, в то время как маршрут реализации (${pathInfo.planet.split(' ')[0]}) требует ${pathInfo.task.toLowerCase()}. Когда эти силы согласованы, внутренняя глубина получает прочный каркас. Если же между ними возникает спор — человек разрывается между желанием действовать по велению сердца и требованием следовать жестким правилам.`
    };
  };

  const synthesis = getSynthesisDynamic(soul, path);

  return (
    <div className="w-full max-w-4xl mx-auto my-8 relative">
      {/* Progress & Stepper Header */}
      <div className="mb-8 px-4">
        <div className="flex items-center justify-between text-xs font-sans tracking-widest uppercase mb-3">
          <span className="text-[var(--color-antique-gold)] font-medium flex items-center gap-2">
            <Compass className="w-4 h-4" /> Шаг {currentStep} из {totalSteps}
          </span>
          <button
            onClick={onViewFullMap}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline flex items-center gap-1 transition-colors"
          >
            Вся карта целиком <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Progress Dots */}
        <div className="w-full bg-[var(--color-antique-gold)]/15 h-1 rounded-full overflow-hidden flex">
          <motion.div 
            className="bg-[var(--color-antique-gold)] h-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="flex justify-between mt-2 px-1">
          {['Душа', 'Действие', 'Соединение', 'Выход', 'Вектор', 'Тень', 'Карта'].map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            return (
              <button
                key={label}
                onClick={() => setCurrentStep(stepNum)}
                className={`text-[9px] sm:text-[10px] tracking-wider uppercase transition-colors hidden sm:block ${
                  isCurrent 
                    ? 'text-[var(--color-antique-gold)] font-bold' 
                    : isCompleted 
                      ? 'text-[var(--color-ink)] opacity-70' 
                      : 'text-[var(--color-muted)] opacity-40'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Narrative Card */}
      <div className="bg-[var(--color-surface)] border border-[var(--border-soft)] p-6 sm:p-12 md:p-16 rounded-sm shadow-xl relative overflow-hidden bg-marble">
        {/* Top gold accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-70" />

        <AnimatePresence mode="wait">
          {/* STEP 1: SOUL */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans text-[var(--color-antique-gold)] block mb-2">
                  Первый Ключ
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-ink)] mb-4">
                  Ваша Душа: Архетип {soulInfo.planet.split(' ')[0]}
                </h2>
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-muted)] max-w-xl mx-auto">
                  «То, как вы ощущаете себя в тишине, когда спадают социальные роли и чужие ожидания».
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-6 border-y border-[var(--border-soft)]">
                <div className="w-28 h-28 rounded-full border-2 border-[var(--color-antique-gold)] flex flex-col items-center justify-center bg-white/60 shadow-sm shrink-0">
                  <span className="font-serif text-4xl font-bold text-[var(--color-ink)]">{soul}</span>
                  {soulComposite !== soul.toString() && (
                    <span className="text-[10px] tracking-widest text-[var(--color-muted)]">{soulComposite}</span>
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left max-w-md">
                  <span className="text-xs uppercase tracking-widest text-[var(--color-antique-gold)] font-sans">
                    {soulInfo.luxuryName}
                  </span>
                  <h4 className="font-serif text-xl font-medium text-[var(--color-ink)]">
                    {soulInfo.planet}
                  </h4>
                  <p className="font-sans text-xs sm:text-sm text-[var(--color-graphite)] leading-relaxed">
                    {soulInfo.core}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-sans text-[var(--color-muted)]">
                  Светлая сторона & Первичный Дар:
                </h4>
                <p className="font-serif text-base sm:text-lg leading-relaxed text-[var(--color-graphite)] bg-[var(--color-ivory)]/70 p-6 border-l-2 border-[var(--color-antique-gold)] italic">
                  «{soulInfo.gift}»
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 2: PATH / ACTION */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans text-[var(--color-antique-gold)] block mb-2">
                  Второй Ключ
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-ink)] mb-4">
                  Как вы действуете: Число Пути
                </h2>
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-muted)] max-w-xl mx-auto">
                  «Сумма всей даты — маршрут, по которому разворачиваются события и формируется ваш жизненный опыт».
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-6 border-y border-[var(--border-soft)]">
                <div className="w-28 h-28 rounded-full border-2 border-[var(--color-antique-gold)] flex flex-col items-center justify-center bg-white/60 shadow-sm shrink-0">
                  <span className="font-serif text-4xl font-bold text-[var(--color-ink)]">{path}</span>
                  {pathComposite !== path.toString() && (
                    <span className="text-[10px] tracking-widest text-[var(--color-muted)]">{pathComposite}</span>
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left max-w-md">
                  <span className="text-xs uppercase tracking-widest text-[var(--color-antique-gold)] font-sans">
                    {pathInfo.luxuryName}
                  </span>
                  <h4 className="font-serif text-xl font-medium text-[var(--color-ink)]">
                    {pathInfo.planet}
                  </h4>
                  <p className="font-sans text-xs sm:text-sm text-[var(--color-graphite)] leading-relaxed">
                    {pathInfo.core}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-sans text-[var(--color-muted)]">
                  Главная задача на маршруте:
                </h4>
                <p className="font-serif text-base sm:text-lg leading-relaxed text-[var(--color-graphite)] bg-[var(--color-ivory)]/70 p-6 border-l-2 border-[var(--color-antique-gold)] italic">
                  «{pathInfo.task}»
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: FIRST CONNECTION / SYNTHESIS */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans text-[var(--color-antique-gold)] block mb-2">
                  Первое Соединение
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-ink)] mb-4">
                  Когда эти две силы встречаются…
                </h2>
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-muted)] max-w-xl mx-auto">
                  Здесь рождается персональная точность: взаимодействие внутреннего импульса и внешнего пути.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 bg-white/70 border border-[var(--border-soft)] rounded-sm">
                <div className="p-4 border-r-0 sm:border-r border-[var(--border-soft)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] block mb-1">Душа ({soul})</span>
                  <h5 className="font-serif text-lg text-[var(--color-ink)] mb-1">{soulInfo.luxuryName}</h5>
                  <p className="font-sans text-xs text-[var(--color-graphite)] opacity-80">{soulInfo.gift}</p>
                </div>
                <div className="p-4">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] block mb-1">Путь ({path})</span>
                  <h5 className="font-serif text-lg text-[var(--color-ink)] mb-1">{pathInfo.luxuryName}</h5>
                  <p className="font-sans text-xs text-[var(--color-graphite)] opacity-80">{pathInfo.task}</p>
                </div>
              </div>

              <div className="p-6 sm:p-8 bg-[var(--color-ivory)] border-l-2 border-[var(--color-antique-gold)] space-y-3">
                <h4 className="font-serif text-xl font-medium text-[var(--color-ink)]">
                  {synthesis.title}
                </h4>
                <p className="font-serif text-base sm:text-lg leading-relaxed text-[var(--color-graphite)]">
                  {synthesis.desc}
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 4: EXPRESSION / OUTPUT */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans text-[var(--color-antique-gold)] block mb-2">
                  Форма и Проявление
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-ink)] mb-4">
                  Где энергия ищет выход
                </h2>
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-muted)] max-w-xl mx-auto">
                  Число Выражения ({expression}) показывает язык, манеру и форму, через которую вы вступаете в контакт с людьми и миром.
                </p>
              </div>

              <div className="p-6 sm:p-8 bg-white/80 border border-[var(--border-soft)] rounded-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border border-[var(--color-antique-gold)] flex items-center justify-center font-serif text-2xl text-[var(--color-ink)]">
                    {expression}
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[var(--color-antique-gold)] font-sans">
                      {exprInfo.planet}
                    </span>
                    <h4 className="font-serif text-xl font-medium text-[var(--color-ink)]">
                      {exprInfo.luxuryName}
                    </h4>
                  </div>
                </div>

                <p className="font-serif text-base sm:text-lg text-[var(--color-graphite)] leading-relaxed pt-2">
                  «Выражение — это ваш инструмент воплощения. Через него внутренняя потребность Души облекается в реальные слова, поступки, проекты и эстетические формы.»
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 5: DIRECTION / VECTOR */}
          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans text-[var(--color-antique-gold)] block mb-2">
                  Вектор Реализации
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-ink)] mb-4">
                  Направление: Число {direction}
                </h2>
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-muted)] max-w-xl mx-auto">
                  Не категоричное «предназначение», а смелая и ясная гипотеза о том, через что вам естественнее всего раскрывать свой потенциал.
                </p>
              </div>

              <div className="p-6 sm:p-8 bg-[var(--color-ivory)] border-l-2 border-[var(--color-antique-gold)] rounded-sm space-y-4">
                <div className="flex items-center gap-3">
                  <Compass className="w-6 h-6 text-[var(--color-antique-gold)]" />
                  <h4 className="font-serif text-2xl font-medium text-[var(--color-ink)]">
                    {dirInfo.luxuryName} ({dirInfo.planet})
                  </h4>
                </div>

                <p className="font-serif text-base sm:text-lg text-[var(--color-graphite)] leading-relaxed">
                  «Сфера максимальной отдачи формулы лежит там, где {dirInfo.gift.toLowerCase()}. Это область, где ваши усилия дают наибольший созидательный отклик и чувство наполненности.»
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 6: TENSION / SHADOW */}
          {currentStep === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans text-amber-700 dark:text-amber-500 block mb-2">
                  Точка Внутреннего Напряжения
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-ink)] mb-4">
                  Внутреннее Противоречие и Тень
                </h2>
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-muted)] max-w-xl mx-auto">
                  «Теперь я понимаю, почему во мне одновременно живут две противоположные потребности».
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-white/80 border border-amber-200/60 rounded-sm space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-amber-800 font-sans font-semibold">
                    Теневой риск Души ({soul})
                  </span>
                  <p className="font-serif text-sm sm:text-base text-[var(--color-graphite)] leading-relaxed">
                    {soulInfo.shadow}
                  </p>
                </div>

                <div className="p-6 bg-white/80 border border-amber-200/60 rounded-sm space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-amber-800 font-sans font-semibold">
                    Теневой риск Пути ({path})
                  </span>
                  <p className="font-serif text-sm sm:text-base text-[var(--color-graphite)] leading-relaxed">
                    {pathInfo.shadow}
                  </p>
                </div>
              </div>

              <div className="p-6 bg-amber-50/50 border border-amber-200/70 rounded-sm">
                <p className="font-serif text-sm sm:text-base italic text-stone-800 leading-relaxed text-center">
                  «Тень — это не дефект характера, а сила, пока не нашедшая своего гармоничного русла. Осознание напряжения снимает внутренний конфликт».
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 7: FULL MAP & COMPOSITE NUMBERS */}
          {currentStep === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans text-[var(--color-antique-gold)] block mb-2">
                  Целостный Образ
                </span>
                <h2 className="font-serif text-3xl sm:text-5xl text-[var(--color-ink)] mb-4">
                  Ваша Символическая Карта Собрана
                </h2>
                <p className="font-serif italic text-base sm:text-lg text-[var(--color-muted)] max-w-xl mx-auto">
                  Все пять ключей соединились в единую живую архитектуру.
                </p>
              </div>

              {/* Symbolic Portrait */}
              <SymbolicPortrait calc={calc} />

              {/* Composite numbers nuance */}
              <div className="p-6 sm:p-8 bg-white/90 border border-[var(--border-soft)] rounded-sm space-y-3">
                <div className="flex items-center gap-2 text-[var(--color-antique-gold)]">
                  <Layers className="w-5 h-5" />
                  <h4 className="font-serif text-lg font-medium text-[var(--color-ink)]">
                    Скрытая глубина составных чисел
                  </h4>
                </div>
                <p className="font-sans text-xs sm:text-sm text-[var(--color-graphite)] leading-relaxed">
                  За вашим числом Пути <strong>{path}</strong> стоит формула <strong>{pathComposite}</strong>. В системе Вяземского важно не только итоговое значение, но и точный маршрут образования энергии. Две восьмерки, рожденные из 17, 26 или 35, звучат совершенно по-разному.
                </p>
              </div>

              {/* Albert Dialogue Teaser */}
              {onOpenAlbertChat && (
                <div className="p-6 sm:p-8 bg-[#141B18] text-[#EAEAEA] border border-[#2A3B33] rounded-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="space-y-1 text-center sm:text-left">
                    <span className="text-[10px] uppercase tracking-widest text-[var(--color-antique-gold)]">
                      Проводник в цифровой код
                    </span>
                    <h4 className="font-serif text-xl sm:text-2xl text-white">
                      Обсудить карту с Альбертом
                    </h4>
                    <p className="font-sans text-xs text-[#A3B8AD] max-w-md">
                      Задайте вопрос о том, как ваша формула проявляется в отношениях, профессии или поиске внутреннего баланса.
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenAlbertChat('Как моя формула проявляется в жизни?')}
                    className="px-6 py-3 bg-[var(--color-antique-gold)] text-white hover:bg-[#B8934C] transition-colors text-xs uppercase tracking-widest font-sans rounded-sm shrink-0 flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> Начать диалог
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stepper Navigation Footer */}
        <div className="mt-12 pt-6 border-t border-[var(--border-soft)] flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2.5 text-xs uppercase tracking-widest font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>

          <div className="flex items-center gap-3">
            {currentStep < totalSteps ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-6 py-2.5 bg-[var(--color-antique-gold)] text-white hover:bg-[#B8934C] text-xs uppercase tracking-widest font-sans rounded-sm flex items-center gap-2 transition-all shadow-sm"
              >
                Следующий ключ <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onViewFullMap}
                className="px-6 py-2.5 bg-[var(--color-ink)] text-white hover:bg-black text-xs uppercase tracking-widest font-sans rounded-sm flex items-center gap-2 transition-all shadow-md"
              >
                Полноформатная Архитектура <Sparkles className="w-4 h-4 text-[var(--color-antique-gold)]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
