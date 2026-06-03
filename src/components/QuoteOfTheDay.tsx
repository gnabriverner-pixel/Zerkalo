import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const DAILY_WISDOM: Record<number, string> = {
  1: "Сегодня — точка отсчёта. В ваших руках сосредоточена искра изначального импульса, способная запустить цепную реакцию создания. Не бойтесь быть первым, ибо пустота ждёт вашего шага.",
  2: "День тонких настроек и дипломатии души. Замечайте невидимые нити между вещами. Самые величественные мосты строятся из способности услышать другого.",
  3: "Пространство слова и расширения. Пусть сегодня ваш голос звучит уверенно и ясно. Радость — это алхимический инструмент, превращающий рутину в золото.",
  4: "Энергия фундамента и структуры. Истинное качество жизни зиждется на порядке. То, во что вы сегодня вложите свой труд, станет несокрушимой скалой для будущего.",
  5: "Ветер перемен ломает ветхие стены. Сегодня день дерзости и выхода за пределы привычного контура. Позвольте себе мыслить парадоксально.",
  6: "Время красоты и заботы о главном. Гармония начинается там, где мастер касается материи с любовью. Внесите эстетику туда, где раньше была лишь механика.",
  7: "День уплотненной тишины. Ответы, которые вы ищете, скрыты не на площади, а во внутренних покоях вашего сердца. Замрите, чтобы услышать шепот истины.",
  8: "Звенящая энергия кармического баланса и материальной силы. Сегодня каждое ваше решение имеет вес и архитектурную точность. Масштаб начинается с ответственности.",
  9: "Время завершения циклов и высшей мудрости. Искусство отпускать то, что отжило — это подготовка плодородной почвы для семян завтрашнего дня."
};

const calculateDayCode = (date: Date): number => {
  const dateStr = format(date, 'ddMMyyyy');
  let sum = parseInt(dateStr.substring(0, 2)) + parseInt(dateStr.substring(2, 4)) + parseInt(dateStr.substring(4, 8));
  
  if (sum === 10 || sum === 11 || sum === 22 || sum === 33) return sum;

  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    sum = sum.toString().split('').reduce((acc, digit) => acc + parseInt(digit), 0);
  }
  
  // if masters appear beyond normal digit reduce, reduce to base for quote lookup
  if (sum === 11) return 2;
  if (sum === 22) return 4;
  if (sum === 33) return 6;
  if (sum === 10) return 1;

  return sum;
};

export const QuoteOfTheDay = () => {
  const { dateFormatted, todayCode, quote } = useMemo(() => {
    const today = new Date();
    const formatted = format(today, 'd MMMM yyyy', { locale: ru });
    const code = calculateDayCode(today);
    // reduce to 1-9 just in case
    const baseCode = code > 9 ? code % 9 || 9 : code;
    return {
      dateFormatted: formatted,
      todayCode: baseCode,
      quote: DAILY_WISDOM[baseCode] || DAILY_WISDOM[1]
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.2 }}
      className="w-full max-w-lg mx-auto mb-10 relative p-6 bg-kraft border border-[var(--color-antique-gold)] border-opacity-30 rounded-sm shadow-sm"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-ivory)] px-4 font-sans text-[0.6rem] tracking-[0.2em] uppercase text-[var(--color-antique-gold)] border border-[var(--color-antique-gold)] border-opacity-30 rounded-full z-10 whitespace-nowrap">
        Энергия Дня • {todayCode}
      </div>
      
      <div className="text-center relative z-0">
        <p className="font-serif text-[0.95rem] md:text-[1.05rem] leading-relaxed text-[var(--color-graphite)] italic">
          «{quote}»
        </p>
        <div className="mt-5 pt-4 border-t border-[var(--border-soft)] flex justify-between items-center opacity-70">
          <span className="font-sans text-[0.6rem] tracking-widest uppercase text-[var(--color-muted)]">
            {dateFormatted}
          </span>
          <span className="font-sans text-[0.6rem] tracking-widest uppercase text-[var(--color-muted)]">
            Пульс Времени
          </span>
        </div>
      </div>
    </motion.div>
  );
};
