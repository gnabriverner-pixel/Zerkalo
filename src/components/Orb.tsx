import React from 'react';

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
  const palette = PLANET_PALETTES[num] || PLANET_PALETTES[1];
  const pxSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 140);

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none ${className}`}
      style={{ width: pxSize, height: pxSize }}
      aria-hidden="true"
    >
      {/* Мягкий внешний туман (9 сек) */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-2xl animate-veil pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, oklch(${palette.hue} / 35%), transparent 70%)`,
          }}
        />
      )}

      {/* Сакральная янтра: 0.3px stroke, медленное вращение 90 сек */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full animate-spin-slow pointer-events-none"
        style={{ color: "oklch(0.8 0.115 74 / 45%)" }}
      >
        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="0.4" />
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 5" />
        <rect x="34" y="34" width="132" height="132" fill="none" stroke="currentColor" strokeWidth="0.3" transform="rotate(45 100 100)" />
        <rect x="34" y="34" width="132" height="132" fill="none" stroke="currentColor" strokeWidth="0.3" />
      </svg>

      {/* Глубокое бархатное ядро */}
      <div
        className="absolute inset-[14%] rounded-full animate-breathe"
        style={{
          background: `radial-gradient(circle at 34% 28%, oklch(${palette.hue}), oklch(${palette.hue2}) 55%, oklch(0.14 0.03 264) 100%)`,
          boxShadow: "0 0 90px -20px oklch(0.8 0.115 74 / 45%), inset 0 0 60px -10px oklch(0 0 0 / 70%)",
        }}
      />

      {/* Тонкая цифра Cormorant Garamond */}
      {showNumber && (
        <div
          className="absolute inset-0 grid place-items-center font-serif text-[#F4F4F4]/90 pointer-events-none font-light"
          style={{ fontSize: pxSize * 0.32, lineHeight: 1 }}
        >
          {num}
        </div>
      )}
    </div>
  );
}
