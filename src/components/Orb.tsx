import React from 'react';

export const PLANET_PALETTES: Record<number, { color: string; glow: string; accent: string; name: string; sanskrit: string }> = {
  1: { color: '#FFB84D', glow: 'rgba(255, 184, 77, 0.35)', accent: '#FFF0C2', name: 'Сурья (Солнце)', sanskrit: 'Surya · Солнце' },
  2: { color: '#99E6FF', glow: 'rgba(153, 230, 255, 0.32)', accent: '#E6F9FF', name: 'Чандра (Луна)', sanskrit: 'Chandra · Луна' },
  3: { color: '#FFD166', glow: 'rgba(255, 209, 102, 0.32)', accent: '#FFF5D6', name: 'Гуру (Юпитер)', sanskrit: 'Guru · Юпитер' },
  4: { color: '#64DFDF', glow: 'rgba(100, 223, 223, 0.30)', accent: '#D8F8F8', name: 'Раху (Северный узел)', sanskrit: 'Rahu · Северный узел' },
  5: { color: '#5EEAD4', glow: 'rgba(94, 234, 212, 0.32)', accent: '#CCFBF1', name: 'Будха (Меркурий)', sanskrit: 'Budha · Меркурий' },
  6: { color: '#F497DA', glow: 'rgba(244, 151, 218, 0.32)', accent: '#FCE7F6', name: 'Шукра (Венера)', sanskrit: 'Shukra · Венера' },
  7: { color: '#B794F4', glow: 'rgba(183, 148, 244, 0.32)', accent: '#EFE8FD', name: 'Кету (Южный узел)', sanskrit: 'Ketu · Южный узел' },
  8: { color: '#7F9CF5', glow: 'rgba(127, 156, 245, 0.32)', accent: '#E2E8F0', name: 'Шани (Сатурн)', sanskrit: 'Shani · Сатурн' },
  9: { color: '#FF758F', glow: 'rgba(255, 117, 143, 0.34)', accent: '#FFE0E6', name: 'Мангала (Марс)', sanskrit: 'Mangala · Марс' },
  11: { color: '#FDE047', glow: 'rgba(253, 224, 71, 0.38)', accent: '#FEF9C3', name: 'Мастер-луч (11/2)', sanskrit: 'Surya-Chandra · 11/2' },
};

const SIZE_MAP: Record<string, number> = {
  sm: 52,
  md: 96,
  lg: 150,
  xl: 210,
};

interface OrbProps {
  number: number;
  size?: number | 'sm' | 'md' | 'lg' | 'xl' | string;
  className?: string;
  glow?: boolean;
  interactive?: boolean;
}

export const Orb: React.FC<OrbProps> = ({ number, size = 180, className = '', glow = true }) => {
  const numericSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 140);
  const reduced = number > 9 && number !== 11 ? ((number - 1) % 9) + 1 : number;
  const palette = PLANET_PALETTES[reduced] || PLANET_PALETTES[1];
  const baseNumber = number > 9 ? ((number - 1) % 9) + 1 : number;

  const renderSacredGeometry = (num: number) => {
    switch (num) {
      case 1:
        return (
          <g>
            {/* Solar corona rays */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="100"
                y1="14"
                x2="100"
                y2={deg % 60 === 0 ? '34' : '24'}
                transform={`rotate(${deg} 100 100)`}
                stroke={palette.color}
                strokeWidth={deg % 60 === 0 ? '1.3' : '0.8'}
                opacity="0.75"
              />
            ))}
            <circle cx="100" cy="100" r="68" fill="none" stroke={palette.color} strokeWidth="1" opacity="0.5" />
            <circle cx="100" cy="100" r="46" fill="none" stroke={palette.color} strokeWidth="1.2" strokeDasharray="3 5" opacity="0.85" />
            <circle cx="100" cy="100" r="24" fill="none" stroke={palette.accent} strokeWidth="1.4" opacity="0.9" />
            <circle cx="100" cy="100" r="6" fill={palette.accent} />
            <circle cx="100" cy="32" r="3" fill={palette.accent} />
          </g>
        );
      case 2:
        return (
          <g>
            <circle cx="80" cy="100" r="46" fill="none" stroke={palette.color} strokeWidth="1.2" opacity="0.8" />
            <circle cx="120" cy="100" r="46" fill="none" stroke={palette.color} strokeWidth="1.2" opacity="0.8" />
            <circle cx="100" cy="100" r="72" fill="none" stroke={palette.color} strokeWidth="0.8" strokeDasharray="2 4" opacity="0.5" />
            <path d="M 100 56 A 46 46 0 0 1 100 144 A 46 46 0 0 1 100 56" fill="none" stroke={palette.accent} strokeWidth="1.3" opacity="0.85" />
            <circle cx="100" cy="100" r="4" fill={palette.accent} />
          </g>
        );
      case 3:
        return (
          <g>
            <polygon points="100,24 166,138 34,138" fill="none" stroke={palette.color} strokeWidth="1.3" opacity="0.85" />
            <polygon points="100,176 166,62 34,62" fill="none" stroke={palette.color} strokeWidth="0.9" strokeDasharray="4 4" opacity="0.55" />
            <circle cx="100" cy="100" r="42" fill="none" stroke={palette.accent} strokeWidth="1" opacity="0.65" />
            <circle cx="100" cy="24" r="3.5" fill={palette.accent} />
            <circle cx="166" cy="138" r="3.5" fill={palette.accent} />
            <circle cx="34" cy="138" r="3.5" fill={palette.accent} />
            <circle cx="100" cy="100" r="4.5" fill={palette.accent} />
          </g>
        );
      case 4:
        return (
          <g>
            <rect x="44" y="44" width="112" height="112" fill="none" stroke={palette.color} strokeWidth="1.2" opacity="0.8" />
            <rect x="44" y="44" width="112" height="112" fill="none" stroke={palette.accent} strokeWidth="1" transform="rotate(45 100 100)" opacity="0.65" />
            <line x1="44" y1="44" x2="156" y2="156" stroke={palette.color} strokeWidth="0.7" opacity="0.45" />
            <line x1="156" y1="44" x2="44" y2="156" stroke={palette.color} strokeWidth="0.7" opacity="0.45" />
            <circle cx="100" cy="100" r="26" fill="none" stroke={palette.accent} strokeWidth="1.2" opacity="0.85" />
            <circle cx="100" cy="100" r="4.5" fill={palette.accent} />
          </g>
        );
      case 5:
        return (
          <g>
            <polygon points="100,22 174,76 146,163 54,163 26,76" fill="none" stroke={palette.color} strokeWidth="1.3" opacity="0.85" />
            <polygon points="100,22 146,163 26,76 174,76 54,163" fill="none" stroke={palette.accent} strokeWidth="0.9" opacity="0.55" />
            <circle cx="100" cy="100" r="32" fill="none" stroke={palette.color} strokeWidth="0.9" strokeDasharray="2 4" />
            <circle cx="100" cy="22" r="3.5" fill={palette.accent} />
            <circle cx="100" cy="100" r="4.5" fill={palette.accent} />
          </g>
        );
      case 6:
        return (
          <g>
            <polygon points="100,24 166,138 34,138" fill="none" stroke={palette.color} strokeWidth="1.2" opacity="0.85" />
            <polygon points="100,176 166,62 34,62" fill="none" stroke={palette.color} strokeWidth="1.2" opacity="0.85" />
            <circle cx="100" cy="100" r="44" fill="none" stroke={palette.accent} strokeWidth="1" opacity="0.7" />
            <circle cx="100" cy="100" r="18" fill="none" stroke={palette.color} strokeWidth="0.9" opacity="0.6" />
            <circle cx="100" cy="100" r="5" fill={palette.accent} />
          </g>
        );
      case 7:
        return (
          <g>
            <circle cx="100" cy="100" r="70" fill="none" stroke={palette.color} strokeWidth="1" strokeDasharray="6 3" opacity="0.7" />
            <polygon points="100,26 158,55 172,118 132,168 68,168 28,118 42,55" fill="none" stroke={palette.color} strokeWidth="1.2" opacity="0.85" />
            <ellipse cx="100" cy="100" rx="50" ry="24" fill="none" stroke={palette.accent} strokeWidth="1" opacity="0.65" />
            <ellipse cx="100" cy="100" rx="24" ry="50" fill="none" stroke={palette.accent} strokeWidth="1" opacity="0.65" />
            <circle cx="100" cy="100" r="5.5" fill={palette.accent} />
          </g>
        );
      case 8:
        return (
          <g>
            {/* Saturn Rings & Octagon */}
            <ellipse cx="100" cy="100" rx="82" ry="30" transform="rotate(-24 100 100)" fill="none" stroke={palette.accent} strokeWidth="1.3" opacity="0.85" />
            <ellipse cx="100" cy="100" rx="72" ry="22" transform="rotate(-24 100 100)" fill="none" stroke={palette.color} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.65" />
            <rect x="52" y="52" width="96" height="96" fill="none" stroke={palette.color} strokeWidth="1.1" opacity="0.75" />
            <rect x="52" y="52" width="96" height="96" fill="none" stroke={palette.color} strokeWidth="1.1" transform="rotate(45 100 100)" opacity="0.75" />
            <circle cx="100" cy="100" r="24" fill="none" stroke={palette.accent} strokeWidth="1.3" />
            <circle cx="100" cy="100" r="5" fill={palette.accent} />
          </g>
        );
      case 9:
      default:
        return (
          <g>
            <polygon points="100,22 167,139 33,139" fill="none" stroke={palette.color} strokeWidth="1.2" opacity="0.85" />
            <polygon points="100,22 167,139 33,139" fill="none" stroke={palette.color} strokeWidth="1.1" transform="rotate(40 100 100)" opacity="0.65" />
            <polygon points="100,22 167,139 33,139" fill="none" stroke={palette.accent} strokeWidth="1.1" transform="rotate(80 100 100)" opacity="0.65" />
            <circle cx="100" cy="100" r="34" fill="none" stroke={palette.accent} strokeWidth="1.2" opacity="0.8" />
            <circle cx="100" cy="100" r="5.5" fill={palette.accent} />
          </g>
        );
    }
  };

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: numericSize, height: numericSize }}
    >
      {/* Radiant Nebula Halo */}
      {glow && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-pulse-glow pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${palette.glow} 0%, rgba(92,225,230,0.08) 45%, transparent 72%)`,
              filter: 'blur(22px)',
            }}
          />
          <div
            className="absolute inset-[18%] rounded-full pointer-events-none opacity-60"
            style={{
              background: `radial-gradient(circle, ${palette.color}33 0%, transparent 70%)`,
              filter: 'blur(10px)',
            }}
          />
        </>
      )}

      {/* Outer Counter-Rotating Star Track */}
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full absolute inset-0 animate-slow-spin-reverse pointer-events-none"
      >
        <circle
          cx="100"
          cy="100"
          r="94"
          fill="none"
          stroke={palette.color}
          strokeWidth="0.6"
          strokeDasharray="1.5 8"
          opacity="0.45"
        />
        <circle cx="100" cy="6" r="2.2" fill={palette.accent} opacity="0.9" />
        <circle cx="194" cy="100" r="1.6" fill={palette.color} opacity="0.7" />
        <circle cx="6" cy="100" r="1.6" fill={palette.color} opacity="0.7" />
      </svg>

      {/* Primary Sacred Geometry Yantra */}
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full relative z-10 animate-slow-spin"
      >
        <circle
          cx="100"
          cy="100"
          r="84"
          fill="none"
          stroke={palette.color}
          strokeWidth="0.75"
          opacity="0.35"
        />
        {renderSacredGeometry(baseNumber)}
      </svg>

      {/* Center Luminous Number Badge when size is small/medium */}
      {numericSize <= 90 && (
        <span
          className="absolute font-serif font-light pointer-events-none z-20 drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]"
          style={{
            color: palette.accent,
            fontSize: Math.max(12, Math.round(numericSize * 0.32)),
          }}
        >
          {number}
        </span>
      )}
    </div>
  );
};
