import React from 'react';

export interface GeometryProps {
  accentColor?: string;
  className?: string;
}

export const SunGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-1">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" opacity="0.6" />
    <circle cx="100" cy="100" r="54" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.7" />
    <line x1="100" y1="12" x2="100" y2="188" stroke="currentColor" strokeWidth="0.8" />
    <line x1="94" y1="36" x2="106" y2="36" stroke="currentColor" strokeWidth="0.5" />
    <line x1="94" y1="164" x2="106" y2="164" stroke="currentColor" strokeWidth="0.5" />
    <circle cx="100" cy="100" r="32" fill="none" stroke={accentColor} strokeWidth="0.6" />
    <line x1="40" y1="40" x2="160" y2="160" stroke={accentColor} strokeWidth="0.3" opacity="0.5" />
    <line x1="160" y1="40" x2="40" y2="160" stroke={accentColor} strokeWidth="0.3" opacity="0.5" />
  </g>
);

export const MoonGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-2">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <line x1="16" y1="100" x2="184" y2="100" stroke="currentColor" strokeWidth="0.6" />
    <line x1="28" y1="116" x2="172" y2="116" stroke="currentColor" strokeWidth="0.3" opacity="0.6" />
    <line x1="44" y1="130" x2="156" y2="130" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" opacity="0.5" />
    <line x1="64" y1="144" x2="136" y2="144" stroke="currentColor" strokeWidth="0.3" opacity="0.4" />
    <path d="M100,34 A36,36 0 0,0 100,100 A28,28 0 0,1 100,34" fill="none" stroke={accentColor} strokeWidth="0.7" />
  </g>
);

export const JupiterGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-3">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.5" />
    <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.7" />
    <circle cx="100" cy="100" r="32" fill="none" stroke={accentColor} strokeWidth="0.6" />
    <line x1="100" y1="100" x2="192" y2="100" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
    <line x1="100" y1="100" x2="165" y2="165" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
    <line x1="100" y1="100" x2="100" y2="192" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
    <line x1="100" y1="100" x2="35" y2="165" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
    <line x1="100" y1="100" x2="8" y2="100" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
    <line x1="100" y1="100" x2="35" y2="35" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
    <line x1="100" y1="100" x2="100" y2="8" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
    <line x1="100" y1="100" x2="165" y2="35" stroke="currentColor" strokeWidth="0.3" opacity="0.45" />
  </g>
);

export const RahuGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-4">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <rect x="36" y="36" width="128" height="128" fill="none" stroke="currentColor" strokeWidth="0.4" />
    <rect x="36" y="36" width="128" height="128" fill="none" stroke={accentColor} strokeWidth="0.5" transform="rotate(45 100 100)" />
    <line x1="16" y1="100" x2="184" y2="100" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
    <line x1="100" y1="16" x2="100" y2="184" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
  </g>
);

export const MercuryGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-5">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <ellipse cx="100" cy="100" rx="84" ry="42" fill="none" stroke="currentColor" strokeWidth="0.4" transform="rotate(30 100 100)" />
    <ellipse cx="100" cy="100" rx="84" ry="42" fill="none" stroke="currentColor" strokeWidth="0.4" transform="rotate(-30 100 100)" />
    <circle cx="100" cy="100" r="24" fill="none" stroke={accentColor} strokeWidth="0.6" />
    <circle cx="100" cy="100" r="4" fill={accentColor} />
  </g>
);

export const VenusGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-6">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <circle cx="100" cy="62" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
    <circle cx="100" cy="138" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
    <circle cx="62" cy="100" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
    <circle cx="138" cy="100" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
    <circle cx="100" cy="100" r="38" fill="none" stroke={accentColor} strokeWidth="0.6" />
  </g>
);

export const KetuGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-7">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <polygon points="100,20 124,170 76,170" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <line x1="100" y1="20" x2="100" y2="170" stroke={accentColor} strokeWidth="0.7" />
    <polygon points="100,20 100,170 76,170" fill="currentColor" opacity="0.06" />
    <circle cx="100" cy="100" r="46" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" />
  </g>
);

export const SaturnGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-8">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <rect x="30" y="44" width="140" height="112" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <line x1="30" y1="72" x2="170" y2="72" stroke="currentColor" strokeWidth="0.3" />
    <line x1="30" y1="100" x2="170" y2="100" stroke={accentColor} strokeWidth="0.6" />
    <line x1="30" y1="128" x2="170" y2="128" stroke="currentColor" strokeWidth="0.3" />
    <line x1="76" y1="44" x2="76" y2="156" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
    <line x1="124" y1="44" x2="124" y2="156" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
  </g>
);

export const MarsGeometry: React.FC<GeometryProps> = ({ accentColor = '#C8A45D' }) => (
  <g id="zk-geo-9">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
    <line x1="28" y1="172" x2="172" y2="28" stroke="currentColor" strokeWidth="0.8" />
    <polygon points="172,28 140,36 164,60" fill="none" stroke={accentColor} strokeWidth="0.6" />
    <circle cx="100" cy="100" r="64" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" />
    <line x1="50" y1="150" x2="150" y2="50" stroke={accentColor} strokeWidth="0.4" opacity="0.6" />
  </g>
);

export const PLANETARY_GEOMETRIES: Record<number, React.FC<GeometryProps>> = {
  1: SunGeometry,
  2: MoonGeometry,
  3: JupiterGeometry,
  4: RahuGeometry,
  5: MercuryGeometry,
  6: VenusGeometry,
  7: KetuGeometry,
  8: SaturnGeometry,
  9: MarsGeometry,
};

export const PLANETARY_METADATA: Record<number, { name: string; sanskrit: string; alloy: string; title: string }> = {
  1: { name: 'Солнце', sanskrit: 'Сурья', alloy: '#E8CE93', title: 'Число Души 1' },
  2: { name: 'Луна', sanskrit: 'Чандра', alloy: '#EAEEF5', title: 'Число Души 2' },
  3: { name: 'Юпитер', sanskrit: 'Гуру', alloy: '#E2B47C', title: 'Число Души 3' },
  4: { name: 'Раху', sanskrit: 'Раху', alloy: '#BCC5D4', title: 'Число Души 4' },
  5: { name: 'Меркурий', sanskrit: 'Будха', alloy: '#E0E7EA', title: 'Число Души 5' },
  6: { name: 'Венера', sanskrit: 'Шукра', alloy: '#EBC5B1', title: 'Число Души 6' },
  7: { name: 'Кету', sanskrit: 'Кету', alloy: '#ADAFBA', title: 'Число Души 7' },
  8: { name: 'Сатурн', sanskrit: 'Шани', alloy: '#A0A5AF', title: 'Число Души 8' },
  9: { name: 'Марс', sanskrit: 'Мангала', alloy: '#D2D9E3', title: 'Число Души 9' },
};
