import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

export const MysticalCompass = () => {
  const { scrollYProgress } = useScroll();
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const rotateReverse = useTransform(scrollYProgress, [0, 1], [0, -360]);

  return (
    <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-16 h-16 md:w-20 md:h-20 pointer-events-none z-40 opacity-40 mix-blend-multiply drop-shadow-sm">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Outer Ring */}
        <motion.circle 
          cx="50" cy="50" r="45" 
          fill="none" 
          stroke="var(--color-antique-gold)" 
          strokeWidth="0.5" 
          strokeDasharray="2 4"
          style={{ rotate, transformOrigin: '50% 50%' }}
        />
        {/* Inner Ring */}
        <motion.circle 
          cx="50" cy="50" r="35" 
          fill="none" 
          stroke="var(--color-antique-gold)" 
          strokeWidth="0.5" 
          style={{ rotate: rotateReverse, transformOrigin: '50% 50%' }}
        />
        {/* Diamond Center */}
        <motion.polygon 
          points="50,15 85,50 50,85 15,50" 
          fill="none" 
          stroke="var(--color-antique-gold)" 
          strokeWidth="0.5"
          style={{ rotate, transformOrigin: '50% 50%' }}
        />
        <motion.polygon 
          points="50,25 75,50 50,75 25,50" 
          fill="var(--color-antique-gold)" 
          opacity="0.2"
          style={{ rotate: rotateReverse, transformOrigin: '50% 50%' }}
        />
        {/* Center Dot */}
        <circle cx="50" cy="50" r="2" fill="var(--color-antique-gold)" />
      </svg>
    </div>
  );
};
