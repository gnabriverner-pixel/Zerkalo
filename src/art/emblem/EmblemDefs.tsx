import React from 'react';

export const EmblemDefs: React.FC = () => {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <defs>
        <filter id="zk-carve" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0.7" dy="0.7" stdDeviation="0.35" floodColor="#FFFFFF" floodOpacity="0.95" />
          <feDropShadow dx="-0.5" dy="-0.5" stdDeviation="0.3" floodColor="#1A1A1C" floodOpacity="0.4" />
        </filter>
        <filter id="zk-deboss" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.25" floodColor="#FFFFFF" floodOpacity="0.9" />
          <feDropShadow dx="0" dy="-0.55" stdDeviation="0.3" floodColor="#1A1A1C" floodOpacity="0.26" />
        </filter>
      </defs>
    </svg>
  );
};
