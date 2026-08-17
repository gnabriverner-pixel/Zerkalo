import React from 'react';
import { EmblemPlate } from '../art/emblem';

export const PLANET_PALETTES: Record<number, { hue: string; hue2: string; name: string; sanskrit: string }> = {
  1: { hue: "0.78 0.12 75",  hue2: "0.45 0.08 60",  name: "Солнце",   sanskrit: "Сурья" },
  2: { hue: "0.82 0.04 240", hue2: "0.40 0.05 250", name: "Луна",     sanskrit: "Чандра" },
  3: { hue: "0.75 0.14 85",  hue2: "0.42 0.09 70",  name: "Юпитер",   sanskrit: "Гуру" },
  4: { hue: "0.60 0.10 280", hue2: "0.32 0.06 270", name: "Раху",     sanskrit: "Раху" },
  5: { hue: "0.72 0.09 160", hue2: "0.38 0.06 170", name: "Меркурий", sanskrit: "Будха" },
  6: { hue: "0.76 0.11 350", hue2: "0.40 0.07 340", name: "Венера",   sanskrit: "Шукра" },
  7: { hue: "0.62 0.12 300", hue2: "0.30 0.08 290", name: "Кету",     sanskrit: "Кету" },
  8: { hue: "0.55 0.06 240", hue2: "0.28 0.04 250", name: "Сатурн",   sanskrit: "Шани" },
  9: { hue: "0.65 0.14 25",  hue2: "0.35 0.09 20",  name: "Марс",     sanskrit: "Мангала" },
};

// Backward-compatibility export
export const PLANET_ORB_CONFIG = PLANET_PALETTES;

const SIZE_MAP: Record<string, number> = {
  xs: 36,
  sm: 48,
  md: 80,
  lg: 128,
  xl: 160
};

export function Orb({
  number = 1,
  size = 140,
  showNumber = true,
  glow = true,
  className = ""
}: {
  number?: number;
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showNumber?: boolean;
  glow?: boolean;
  className?: string;
}) {
  const num = Math.max(1, Math.min(9, Math.round(number) || 1));
  const pxSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 140);

  return (
    <div className={`relative shrink-0 inline-flex items-center justify-center select-none ${className}`}>
      <EmblemPlate
        planet={num}
        variant="obsidian"
        size={pxSize}
        showNumber={showNumber}
        showLabel={false}
      />
    </div>
  );
}

export default Orb;
