import React from 'react';
import { motion } from 'motion/react';

export interface OrbProps {
  number: number;
  planet?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  className?: string;
  glow?: boolean;
}

// Planetary configurations for the 9 Vedic numbers
export const PLANET_ORB_CONFIG: Record<number, {
  name: string;
  sanskrit: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  glowColor: string;
  haloRgba: string;
  coreGradient: string;
  yantraStyle: 'sun' | 'moon' | 'jupiter' | 'rahu' | 'mercury' | 'venus' | 'ketu' | 'saturn' | 'mars';
}> = {
  1: {
    name: 'Солнце',
    sanskrit: 'Сурья',
    primaryColor: '#F59E0B',
    secondaryColor: '#D97706',
    accentColor: '#FDE68A',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    haloRgba: 'rgba(217, 119, 6, 0.25)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #FFFBEB 0%, #FBBF24 45%, #B45309 85%, #78350F 100%)',
    yantraStyle: 'sun'
  },
  2: {
    name: 'Луна',
    sanskrit: 'Чандра',
    primaryColor: '#C7D2FE',
    secondaryColor: '#818CF8',
    accentColor: '#FFFFFF',
    glowColor: 'rgba(199, 210, 254, 0.45)',
    haloRgba: 'rgba(129, 140, 248, 0.2)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #E0E7FF 40%, #A5B4FC 80%, #4338CA 100%)',
    yantraStyle: 'moon'
  },
  3: {
    name: 'Юпитер',
    sanskrit: 'Гуру',
    primaryColor: '#FBBF24',
    secondaryColor: '#D97706',
    accentColor: '#FEF3C7',
    glowColor: 'rgba(251, 191, 36, 0.4)',
    haloRgba: 'rgba(180, 83, 9, 0.25)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #FFFBEB 0%, #F59E0B 40%, #B45309 80%, #451A03 100%)',
    yantraStyle: 'jupiter'
  },
  4: {
    name: 'Раху',
    sanskrit: 'Раху',
    primaryColor: '#6366F1',
    secondaryColor: '#4338CA',
    accentColor: '#A5B4FC',
    glowColor: 'rgba(99, 102, 241, 0.4)',
    haloRgba: 'rgba(67, 56, 202, 0.3)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #E0E7FF 0%, #6366F1 45%, #312E81 85%, #1E1B4B 100%)',
    yantraStyle: 'rahu'
  },
  5: {
    name: 'Меркурий',
    sanskrit: 'Будха',
    primaryColor: '#10B981',
    secondaryColor: '#059669',
    accentColor: '#A7F3D0',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    haloRgba: 'rgba(5, 150, 105, 0.25)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #ECFDF5 0%, #34D399 40%, #059669 80%, #064E3B 100%)',
    yantraStyle: 'mercury'
  },
  6: {
    name: 'Венера',
    sanskrit: 'Шукра',
    primaryColor: '#EC4899',
    secondaryColor: '#BE185D',
    accentColor: '#FCE7F3',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    haloRgba: 'rgba(190, 24, 93, 0.25)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #FFF1F2 0%, #F472B6 40%, #BE185D 80%, #831843 100%)',
    yantraStyle: 'venus'
  },
  7: {
    name: 'Кету',
    sanskrit: 'Кету',
    primaryColor: '#8B5CF6',
    secondaryColor: '#6D28D9',
    accentColor: '#DDD6FE',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    haloRgba: 'rgba(109, 40, 217, 0.3)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #F5F3FF 0%, #A78BFA 45%, #6D28D9 80%, #2E1065 100%)',
    yantraStyle: 'ketu'
  },
  8: {
    name: 'Сатурн',
    sanskrit: 'Шани',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    accentColor: '#BFDBFE',
    glowColor: 'rgba(59, 130, 246, 0.35)',
    haloRgba: 'rgba(30, 64, 175, 0.25)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #EFF6FF 0%, #60A5FA 40%, #1E40AF 80%, #0F172A 100%)',
    yantraStyle: 'saturn'
  },
  9: {
    name: 'Марс',
    sanskrit: 'Мангала',
    primaryColor: '#EF4444',
    secondaryColor: '#B91C1C',
    accentColor: '#FECACA',
    glowColor: 'rgba(239, 68, 68, 0.45)',
    haloRgba: 'rgba(185, 28, 28, 0.3)',
    coreGradient: 'radial-gradient(circle at 35% 35%, #FEF2F2 0%, #F87171 40%, #B91C1C 80%, #450A0A 100%)',
    yantraStyle: 'mars'
  }
};

const sizeMap = {
  xs: { size: 36, stroke: 1, ringOffset: 4, numSize: 'text-[11px]' },
  sm: { size: 56, stroke: 1.2, ringOffset: 6, numSize: 'text-sm' },
  md: { size: 84, stroke: 1.5, ringOffset: 9, numSize: 'text-xl' },
  lg: { size: 128, stroke: 1.5, ringOffset: 12, numSize: 'text-3xl' },
  xl: { size: 180, stroke: 1.8, ringOffset: 16, numSize: 'text-5xl' }
};

export function Orb({
  number,
  planet,
  size = 'md',
  interactive = false,
  className = '',
  glow = true
}: OrbProps) {
  // Normalize number to 1-9
  const num = Math.max(1, Math.min(9, Math.round(number) || 1));
  const cfg = PLANET_ORB_CONFIG[num] || PLANET_ORB_CONFIG[1];
  const s = sizeMap[size];

  return (
    <div 
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: s.size, height: s.size }}
    >
      {/* Outer Halo Glow */}
      {glow && (
        <div 
          className="absolute inset-0 rounded-full blur-xl pointer-events-none transition-all duration-700"
          style={{ 
            background: cfg.haloRgba,
            transform: 'scale(1.4)'
          }}
        />
      )}

      {/* Rotating Sacred Yantra Rings SVG */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke={cfg.primaryColor}
          strokeWidth="0.8"
          strokeDasharray="4 6"
          opacity="0.5"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={cfg.accentColor}
          strokeWidth="0.6"
          opacity="0.3"
        />
        {/* Geometric Cross/Star elements depending on archetype */}
        {num % 2 === 1 ? (
          <polygon
            points="50,6 88,72 12,72"
            fill="none"
            stroke={cfg.primaryColor}
            strokeWidth="0.6"
            opacity="0.25"
          />
        ) : (
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            fill="none"
            stroke={cfg.primaryColor}
            strokeWidth="0.6"
            opacity="0.25"
            transform="rotate(45 50 50)"
          />
        )}
      </motion.svg>

      {/* Counter-rotating Inner Yantra Ring */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full pointer-events-none"
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke={cfg.secondaryColor}
          strokeWidth="0.7"
          strokeDasharray="2 8"
          opacity="0.4"
        />
      </motion.svg>

      {/* Sphere Core */}
      <motion.div
        whileHover={interactive ? { scale: 1.08 } : undefined}
        className="relative rounded-full flex items-center justify-center shadow-lg overflow-hidden border border-white/20"
        style={{
          width: s.size - s.ringOffset * 2,
          height: s.size - s.ringOffset * 2,
          background: cfg.coreGradient,
          boxShadow: `0 4px 20px ${cfg.glowColor}, inset 0 2px 4px rgba(255, 255, 255, 0.4)`
        }}
      >
        {/* Inner light reflection */}
        <div className="absolute top-1 left-2 w-1/3 h-1/4 rounded-full bg-white/40 blur-[1px] pointer-events-none transform -rotate-45" />

        {/* The Golden Number */}
        <span 
          className={`font-serif font-bold text-white tracking-tighter drop-shadow-md z-10 ${s.numSize}`}
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
        >
          {num}
        </span>
      </motion.div>
    </div>
  );
}
