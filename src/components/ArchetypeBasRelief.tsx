import React from 'react';
import { EmblemPlate } from '../art/emblem/EmblemPlate';
import { PLANETARY_METADATA } from '../art/emblem/geometry';

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

export interface ArchetypeBasReliefProps {
  number?: number;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  showNumber?: boolean;
  showLabels?: boolean;
  variant?: 'alabaster' | 'obsidian';
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
  variant = 'alabaster',
  className = ""
}: ArchetypeBasReliefProps) {
  const num = Number(number);
  const meta = ARCHETYPE_VISUALS[num];
  const pxSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 200);

  return (
    <div
      className={`relative shrink-0 flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: pxSize, height: pxSize }}
      aria-label={meta ? `Архетип ${meta.title} (${num})` : 'Архетип'}
    >
      <EmblemPlate
        planet={num}
        variant={variant}
        size={pxSize}
        showNumber={showNumber}
        showLabel={showLabels}
      />
    </div>
  );
}

export default ArchetypeBasRelief;

