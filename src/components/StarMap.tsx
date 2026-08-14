import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { calculateDigitalCode } from '../services/calculator';
import { format } from 'date-fns';

registerLocale('ru', ru);

const FIXED_CONSTELLATIONS = [
  {
    id: 'origin',
    name: 'Созвездие Истока',
    points: [
      { x: 15, y: 30 }, { x: 30, y: 15 }, { x: 45, y: 25 }, { x: 35, y: 45 }, { x: 20, y: 40 }
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2]],
    description: 'Здесь зародилась ваша первая искра. Период чистого потенциала, когда мир казался огромным океаном возможностей, а каждый шаг оставлял светящийся след на песке времени.'
  },
  {
    id: 'trial',
    name: 'Рубеж Испытаний',
    points: [
      { x: 60, y: 20 }, { x: 75, y: 10 }, { x: 90, y: 25 }, { x: 80, y: 40 }, { x: 65, y: 35 }
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 3]],
    description: 'Темные воды и скрытые течения. Период, когда вам пришлось выковать внутренний стержень. Звезды здесь горят холодным, но несокрушимым светом преодоления.'
  },
  {
    id: 'awakening',
    name: 'Корона Пробуждения',
    points: [
      { x: 25, y: 70 }, { x: 40, y: 55 }, { x: 55, y: 65 }, { x: 45, y: 85 }, { x: 30, y: 80 }
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 4]],
    description: 'Момент, когда иллюзии спали. Вы впервые увидели узор своей судьбы без искажений. Это время инсайтов и возвращения к своей истинной, забытой природе.'
  },
  {
    id: 'synthesis',
    name: 'Ось Синтеза',
    points: [
      { x: 65, y: 70 }, { x: 80, y: 55 }, { x: 95, y: 65 }, { x: 85, y: 85 }, { x: 70, y: 80 }
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 4]],
    description: 'Соединение несовместимого. Эпоха, когда ваши раны стали вашей силой, а разрозненные таланты сплелись в единый, мощный луч созидания.'
  }
];

export const StarMap = () => {
  const [activeConstellation, setActiveConstellation] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [personalConstellation, setPersonalConstellation] = useState<any | null>(null);

  useEffect(() => {
    if (birthDate) {
      try {
        const dateStr = format(birthDate, 'dd.MM.yyyy');
        const code = calculateDigitalCode(dateStr);
        
        const todayStr = format(new Date(), 'dd.MM.yyyy');
        const todayCode = calculateDigitalCode(todayStr);

        // Core numbers determining star positions
        const baseNumbers = [
          code.soul,
          code.path,
          code.direction,
          code.expression,
          code.result
        ];
        
        const points = baseNumbers.map((num, i) => {
          const angle = (i * 72 - 90) * (Math.PI / 180);
          const radius = 10 + (num % 9) * 1.5; // Central cluster
          return {
            x: 50 + radius * Math.cos(angle),
            y: 50 + radius * Math.sin(angle),
            label: ['Душа', 'Путь', 'Направление', 'Выражение', 'Итог'][i]
          };
        });
        
        const lines: [number, number][] = [];
        const todaySeed = todayCode.path % 5;
        
        for (let i = 0; i < 5; i++) {
          lines.push([i, (i + 1 + (todaySeed % 2)) % 5]);
        }
        lines.push([0, 2]); // Core connection

        setPersonalConstellation({
          id: 'personal',
          name: 'Узор Вашей Судьбы',
          points,
          lines,
          description: `Уникальное созвездие, рожденное из вашего кода: ${code.soulComposite} • ${code.pathComposite}. Линии судьбы сегодня начертаны под вибрацией числа ${todayCode.path}, открывая новые маршруты в вашем мифе.`
        });
      } catch (e) {
        setPersonalConstellation(null);
      }
    } else {
      setPersonalConstellation(null);
    }
  }, [birthDate]);

  const allConstellations = personalConstellation 
    ? [...FIXED_CONSTELLATIONS, personalConstellation] 
    : FIXED_CONSTELLATIONS;

  return (
    <div className="w-full mt-24 mb-16 relative">
      <div className="text-center mb-8">
        <h3 className="font-serif text-3xl md:text-4xl text-[#EAEAEA] drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-4">
          Карта Вашего Неба
        </h3>
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-[#A3B8AD]">
          Нажмите на созвездие, чтобы прочитать его миф
        </p>
      </div>

      <div className="flex justify-center mb-12">
        <div className="relative w-64 bg-[#1A2621]/50 backdrop-blur-md rounded-sm border border-[#A3B8AD]/30 p-2">
          <DatePicker
            selected={birthDate}
            onChangeRaw={(e) => {
              const target = e?.target as HTMLInputElement | undefined;
              if (!target || typeof target.value !== 'string') return;
              let val = target.value.replace(/[^\d]/g, '');
              if (val.length > 2) val = val.substring(0, 2) + '.' + val.substring(2);
              if (val.length > 5) val = val.substring(0, 5) + '.' + val.substring(5, 9);
              setDateInput(val);
              target.value = val;
            }}
            onChange={(date) => {
              setBirthDate(date);
              if (date) setDateInput(format(date, 'dd.MM.yyyy'));
              setActiveConstellation('personal');
            }}
            dateFormat="dd.MM.yyyy"
            placeholderText="Ваша дата рождения"
            className="w-full bg-transparent text-center font-serif text-sm tracking-widest text-[#EAEAEA] outline-none placeholder:text-[#A3B8AD]/50"
            wrapperClassName="w-full"
          />
        </div>
      </div>

      <div className="relative w-full aspect-[4/3] md:aspect-video bg-[#0F1412] border border-[#2A3B33] rounded-sm overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.8)]">
        
        {/* Background ambient stars */}
        <div className="absolute inset-0 opacity-30 mix-blend-screen" style={{ backgroundImage: 'radial-gradient(1px 1px at 10px 10px, #fff, transparent), radial-gradient(1.5px 1.5px at 30px 40px, #fff, transparent)', backgroundSize: '60px 60px' }}></div>

        <svg viewBox="0 0 100 100" className="w-full h-full relative z-10" preserveAspectRatio="xMidYMid slice">
          {allConstellations.map((constellation) => {
            const isActive = activeConstellation === constellation.id;
            const isDimmed = activeConstellation !== null && !isActive;
            const isPersonal = constellation.id === 'personal';

            return (
              <g 
                key={constellation.id}
                className="cursor-pointer transition-opacity duration-1000"
                style={{ opacity: isDimmed ? 0.2 : 1 }}
                onClick={() => setActiveConstellation(isActive ? null : constellation.id)}
              >
                {/* Lines */}
                {constellation.lines.map(([p1, p2], i) => (
                  <motion.line
                    key={`line-${i}`}
                    x1={constellation.points[p1].x}
                    y1={constellation.points[p1].y}
                    x2={constellation.points[p2].x}
                    y2={constellation.points[p2].y}
                    stroke={isActive ? "var(--color-antique-gold)" : (isPersonal ? "#FFF" : "#A3B8AD")}
                    strokeWidth={isActive ? "0.4" : "0.2"}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ 
                      pathLength: 1, 
                      opacity: isActive ? 0.8 : 0.4 
                    }}
                    transition={{ duration: 2, delay: i * 0.15 }}
                  />
                ))}

                {/* Stars / Points */}
                {constellation.points.map((point, i) => (
                  <g key={`point-${i}`}>
                    {isActive && (
                      <motion.circle
                        cx={point.x}
                        cy={point.y}
                        r={isPersonal ? "4" : "3"}
                        fill="none"
                        stroke="var(--color-antique-gold)"
                        strokeWidth="0.1"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 2, opacity: [0, 0.5, 0] }}
                        transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
                      />
                    )}
                    <motion.circle
                      cx={point.x}
                      cy={point.y}
                      r={isActive ? "1" : "0.6"}
                      fill={isActive ? "#FFF" : (isPersonal ? "#EAEAEA" : "#EAEAEA")}
                      style={{ filter: isActive ? 'drop-shadow(0 0 2px var(--color-antique-gold))' : 'drop-shadow(0 0 1px #FFF)' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 3 + Math.random() * 2, repeat: Infinity }}
                    />
                    {isPersonal && isActive && (
                      <text x={point.x} y={point.y + 2.5} fontSize="1.5" fill="var(--color-antique-gold)" textAnchor="middle" opacity="0.8" className="font-sans uppercase">
                        {(point as any).label}
                      </text>
                    )}
                  </g>
                ))}

                {/* Invisible hit area for easier clicking */}
                <polygon 
                  points={constellation.points.map(p => `${p.x},${p.y}`).join(' ')} 
                  fill="transparent"
                  stroke="none"
                />
              </g>
            );
          })}
        </svg>

        {/* Text Overlay */}
        <AnimatePresence>
          {activeConstellation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.5 }}
              className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-auto md:w-80 bg-[#0F1412]/80 backdrop-blur-md border border-[var(--color-antique-gold)]/30 p-6 rounded-sm shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-20"
            >
              <h4 className="font-serif text-xl text-[var(--color-antique-gold)] mb-3">
                {allConstellations.find(c => c.id === activeConstellation)?.name}
              </h4>
              <p className="font-sans text-sm text-[#EAEAEA] leading-relaxed opacity-90">
                {allConstellations.find(c => c.id === activeConstellation)?.description}
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveConstellation(null); }}
                className="mt-6 text-[10px] tracking-widest uppercase text-[#A3B8AD] hover:text-[#FFF] transition-colors"
              >
                Закрыть
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
