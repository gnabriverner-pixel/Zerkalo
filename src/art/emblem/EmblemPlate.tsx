import React from 'react';
import { PLANETARY_GEOMETRIES, PLANETARY_METADATA } from './geometry';
import { useRakingLight } from './useRakingLight';
import './emblem.css';

export interface EmblemPlateProps {
  planet: number; // 1..9
  variant?: 'alabaster' | 'obsidian';
  size?: number | string;
  interactive?: boolean;
  showLabel?: boolean;
  showNumber?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const EmblemPlate: React.FC<EmblemPlateProps> = ({
  planet,
  variant = 'alabaster',
  size,
  interactive = true,
  showLabel = true,
  showNumber = true,
  className = '',
  style = {},
}) => {
  const [sweepKey, setSweepKey] = React.useState(0);
  const pNum = Number(planet);
  const isValidPlanet = Number.isInteger(pNum) && pNum >= 1 && pNum <= 9;

  const sizeStyle: React.CSSProperties = size
    ? { width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }
    : {};

  if (!isValidPlanet) {
    return (
      <div
        className={`zk-plate-invalid rounded-xl sm:rounded-2xl border border-stone-800/60 bg-[#0A0C10] flex items-center justify-center text-stone-500 font-mono text-[10px] uppercase tracking-wider aspect-square ${className}`}
        style={{ ...sizeStyle, ...style }}
        aria-label="Неверный архетип"
      >
        <span>—</span>
      </div>
    );
  }

  const GeometryComponent = PLANETARY_GEOMETRIES[pNum];
  const metadata = PLANETARY_METADATA[pNum];

  const plateRef = useRakingLight<HTMLDivElement>({
    enabled: interactive && variant === 'alabaster',
    maxOffsetPx: 12,
  });

  const handleTap = () => {
    if (variant === 'alabaster') {
      setSweepKey((prev) => prev + 1);
    }
  };

  if (variant === 'obsidian') {
    return (
      <div
        ref={plateRef}
        className={`zk-plate-obsidian rounded-xl sm:rounded-2xl ${className}`}
        style={{ ...sizeStyle, ...style }}
      >
        {/* Main Emblem */}
        <svg
          viewBox="0 0 200 200"
          className="zk-emblem-svg"
          style={{ color: metadata.alloy }}
        >
          <GeometryComponent accentColor="#D9B978" />
        </svg>

        {/* Reflection in Dark Glass */}
        <svg
          viewBox="0 0 200 200"
          aria-hidden="true"
          className="zk-reflect-svg"
          style={{ color: metadata.alloy }}
        >
          <GeometryComponent accentColor="#D9B978" />
        </svg>

        {/* Specular Light Sweep */}
        <div className="zk-spec-light" />

        {/* Top-Left Planet Number */}
        {showNumber && (
          <span
            className="absolute left-3 top-2.5 font-mono text-[9px] tracking-[0.18em] text-[#6E7078] select-none"
          >
            0{pNum}
          </span>
        )}

        {/* Bottom-Right Planet Name */}
        {showLabel && (
          <span
            className="absolute right-3 bottom-2.5 font-serif text-[13px] font-light tracking-[0.06em] text-[#A7A9B1] select-none"
          >
            {metadata.name}
          </span>
        )}
      </div>
    );
  }

  // Alabaster variant
  return (
    <div
      ref={plateRef}
      onClick={handleTap}
      className={`zk-plate-alabaster rounded-xl sm:rounded-2xl cursor-pointer ${className}`}
      style={{ ...sizeStyle, ...style }}
    >
      {/* Bas-Relief Carved SVG */}
      <svg
        viewBox="0 0 200 200"
        className="zk-emblem-svg"
      >
        <GeometryComponent accentColor="#C8A45D" />
      </svg>

      {/* Entry Sweep Light (Re-triggered on tap / mount) */}
      <div key={sweepKey} className="zk-sweep-light" />

      {/* Top-Left Planet Number */}
      {showNumber && (
        <span
          className="absolute left-3 top-2.5 font-mono text-[9px] tracking-[0.18em] text-[#9A9CA3] select-none"
        >
          0{pNum}
        </span>
      )}

      {/* Bottom-Right Planet Name */}
      {showLabel && (
        <span
          className="absolute right-3 bottom-2.5 font-serif text-[13px] font-light tracking-[0.06em] text-[#63656C] select-none"
        >
          {metadata.name}
        </span>
      )}
    </div>
  );
};
