import React from 'react';

export interface ArchetypeVisualMeta {
  number: number;
  title: string;
  sanskrit: string;
  planet: string;
  motif: string;
  essence: string;
}

export const ARCHETYPE_VISUALS: Record<number, ArchetypeVisualMeta> = {
  1: {
    number: 1,
    title: "Новатор и Создатель",
    sanskrit: "Сурья",
    planet: "Солнце",
    motif: "Монолитный луч",
    essence: "Воля, автономность, импульс начала, прямое авторство"
  },
  2: {
    number: 2,
    title: "Дипломат и Хранитель Связи",
    sanskrit: "Чандра",
    planet: "Луна",
    motif: "Зеркальная вода",
    essence: "Эмпатия, отражение, восприимчивость, глубина связи"
  },
  3: {
    number: 3,
    title: "Учитель и Наставник",
    sanskrit: "Гуру",
    planet: "Юпитер",
    motif: "Ротонда мудрости",
    essence: "Масштаб, системность, закон расширения, передача знаний"
  },
  4: {
    number: 4,
    title: "Реформатор и Стратег",
    sanskrit: "Раху",
    planet: "Северный Узел",
    motif: "Оптический лабиринт",
    essence: "Прорыв за рамки, нестандартное видение, масштабные цели"
  },
  5: {
    number: 5,
    title: "Коммуникатор и Интегратор",
    sanskrit: "Будха",
    planet: "Меркурий",
    motif: "Кинетический маятник",
    essence: "Подвижность ума, точность слова, скорость связей"
  },
  6: {
    number: 6,
    title: "Мастер Гармонии и Формы",
    sanskrit: "Шукра",
    planet: "Венера",
    motif: "Алебастровая драпировка",
    essence: "Эстетическое совершенство, вкус, осязаемое качество формы"
  },
  7: {
    number: 7,
    title: "Исследователь Глубины",
    sanskrit: "Кету",
    planet: "Южный Узел",
    motif: "Тень обелиска",
    essence: "Глубинный анализ, внутренняя тишина, отсечение суеты"
  },
  8: {
    number: 8,
    title: "Архитектор и Хранитель Закона",
    sanskrit: "Шани",
    planet: "Сатурн",
    motif: "Тесаный гранит времени",
    essence: "Структура, терпение, закон тяжести, выдержка масштаба"
  },
  9: {
    number: 9,
    title: "Защитник и Проводник Энергии",
    sanskrit: "Мангала",
    planet: "Марс",
    motif: "Кованое лезвие",
    essence: "Прямое действие, динамика, защита слабых, служение цели"
  }
};

interface ArchetypeBasReliefProps {
  number?: number;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  showNumber?: boolean;
  showLabels?: boolean;
  className?: string;
}

const SIZE_MAP: Record<string, number> = {
  sm: 72,
  md: 120,
  lg: 200,
  xl: 260
};

export function ArchetypeBasRelief({
  number = 1,
  size = 200,
  showNumber = true,
  showLabels = false,
  className = ""
}: ArchetypeBasReliefProps) {
  const num = Math.max(1, Math.min(9, Math.round(number) || 1));
  const meta = ARCHETYPE_VISUALS[num] || ARCHETYPE_VISUALS[1];
  const pxSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 200);

  // Render specific geometric bas-relief based on archetype
  const renderGeometry = () => {
    switch (num) {
      case 1: // Sun · Monolith Beam
        return (
          <g>
            {/* Concentric solar arcs */}
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" opacity="0.6" />
            <circle cx="100" cy="100" r="54" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.7" />
            {/* Vertical Monolith Shaft */}
            <line x1="100" y1="12" x2="100" y2="188" stroke="currentColor" strokeWidth="0.8" />
            <line x1="94" y1="36" x2="106" y2="36" stroke="currentColor" strokeWidth="0.5" />
            <line x1="94" y1="164" x2="106" y2="164" stroke="currentColor" strokeWidth="0.5" />
            {/* Solar rays */}
            <circle cx="100" cy="100" r="32" fill="none" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.6" />
            <line x1="40" y1="40" x2="160" y2="160" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.3" opacity="0.5" />
            <line x1="160" y1="40" x2="40" y2="160" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.3" opacity="0.5" />
          </g>
        );

      case 2: // Moon · Mirror Water
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {/* Horizon and water lines */}
            <line x1="16" y1="100" x2="184" y2="100" stroke="currentColor" strokeWidth="0.6" />
            <line x1="28" y1="116" x2="172" y2="116" stroke="currentColor" strokeWidth="0.3" opacity="0.6" />
            <line x1="44" y1="130" x2="156" y2="130" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" opacity="0.5" />
            <line x1="64" y1="144" x2="136" y2="144" stroke="currentColor" strokeWidth="0.3" opacity="0.4" />
            {/* Crescent moon reflection */}
            <path
              d="M100,34 A36,36 0 0,0 100,100 A28,28 0 0,1 100,34"
              fill="none"
              stroke="var(--gold-leaf, #C8A45D)"
              strokeWidth="0.7"
            />
          </g>
        );

      case 3: // Jupiter · Rotunda
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.5" />
            <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.7" />
            <circle cx="100" cy="100" r="32" fill="none" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.6" />
            {/* 8 Arch lines */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <line
                key={i}
                x1="100"
                y1="100"
                x2={100 + 92 * Math.cos((angle * Math.PI) / 180)}
                y2={100 + 92 * Math.sin((angle * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="0.3"
                opacity="0.45"
              />
            ))}
          </g>
        );

      case 4: // Rahu · Prism Labyrinth
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {/* Diamond and 45-deg prism cuts */}
            <rect x="36" y="36" width="128" height="128" fill="none" stroke="currentColor" strokeWidth="0.4" />
            <rect x="36" y="36" width="128" height="128" fill="none" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.5" transform="rotate(45 100 100)" />
            <line x1="16" y1="100" x2="184" y2="100" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
            <line x1="100" y1="16" x2="100" y2="184" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
          </g>
        );

      case 5: // Mercury · Kinetic Pendulum
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {/* Elliptical orbits */}
            <ellipse cx="100" cy="100" rx="84" ry="42" fill="none" stroke="currentColor" strokeWidth="0.4" transform="rotate(30 100 100)" />
            <ellipse cx="100" cy="100" rx="84" ry="42" fill="none" stroke="currentColor" strokeWidth="0.4" transform="rotate(-30 100 100)" />
            <circle cx="100" cy="100" r="24" fill="none" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.6" />
            <circle cx="100" cy="100" r="4" fill="var(--gold-leaf, #C8A45D)" />
          </g>
        );

      case 6: // Venus · Alabaster Drapery
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {/* Harmonic spiral & flower of proportions */}
            <circle cx="100" cy="62" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
            <circle cx="100" cy="138" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
            <circle cx="62" cy="100" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
            <circle cx="138" cy="100" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
            <circle cx="100" cy="100" r="38" fill="none" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.6" />
          </g>
        );

      case 7: // Ketu · Obelisk Shadow
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {/* Triangular Obelisk and Deep Vertical Shadow */}
            <polygon points="100,20 124,170 76,170" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <line x1="100" y1="20" x2="100" y2="170" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.7" />
            <polygon points="100,20 100,170 76,170" fill="currentColor" opacity="0.06" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" />
          </g>
        );

      case 8: // Saturn · Basalt Plate
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {/* Heavy layered geologic plates */}
            <rect x="30" y="44" width="140" height="112" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <line x1="30" y1="72" x2="170" y2="72" stroke="currentColor" strokeWidth="0.3" />
            <line x1="30" y1="100" x2="170" y2="100" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.6" />
            <line x1="30" y1="128" x2="170" y2="128" stroke="currentColor" strokeWidth="0.3" />
            <line x1="76" y1="44" x2="76" y2="156" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
            <line x1="124" y1="44" x2="124" y2="156" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
          </g>
        );

      case 9: // Mars · Forged Blade
        return (
          <g>
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {/* Dynamic 45-deg spear / blade line */}
            <line x1="28" y1="172" x2="172" y2="28" stroke="currentColor" strokeWidth="0.8" />
            <polygon points="172,28 140,36 164,60" fill="none" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.6" />
            <circle cx="100" cy="100" r="64" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" />
            <line x1="50" y1="150" x2="150" y2="50" stroke="var(--gold-leaf, #C8A45D)" strokeWidth="0.4" opacity="0.6" />
          </g>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`relative shrink-0 flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: pxSize, height: pxSize }}
      aria-label={`Архетип ${meta.title} (${num})`}
    >
      {/* 1. Marble Halo & Diffuse Ambient Light */}
      <div 
        className="absolute inset-0 rounded-full animate-pulse-gentle pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, oklch(0.74 0.09 75 / 8%), transparent 75%)',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.02)'
        }}
      />

      {/* 2. Slow Rotating Sacred Yantra & Bas-Relief Lines */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full animate-spin-slow pointer-events-none text-[#1A1A1C]/75"
        style={{ color: 'var(--text-graphite, #1A1A1C)' }}
      >
        {renderGeometry()}
      </svg>

      {/* 3. Central Tactile Alabaster Core Disc */}
      <div
        className="absolute inset-[22%] rounded-full flex items-center justify-center border border-[var(--border-hairline,#1A1A1C/8%)]"
        style={{
          background: 'radial-gradient(circle at 35% 30%, oklch(0.99 0.004 85), oklch(0.965 0.012 85) 65%, oklch(0.94 0.015 85) 100%)',
          boxShadow: '0 4px 20px -4px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -2px 6px rgba(0,0,0,0.04)'
        }}
      >
        {/* Crisp Engraved Digit */}
        {showNumber && (
          <span 
            className="font-serif font-light text-[var(--text-graphite,#1A1A1C)] tracking-tight select-none"
            style={{ fontSize: pxSize * 0.26, lineHeight: 1 }}
          >
            {num}
          </span>
        )}
      </div>

      {/* Optional Metadata Labels below */}
      {showLabels && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
          <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--text-ash,#63656C)] block">
            {meta.sanskrit} · {meta.motif}
          </span>
        </div>
      )}
    </div>
  );
}

export default ArchetypeBasRelief;
