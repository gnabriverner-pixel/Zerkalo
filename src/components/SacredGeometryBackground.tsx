import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

export const SacredGeometryBackground = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) - 0.5,
        y: (e.clientY / window.innerHeight) - 0.5
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const smoothX = useSpring(mousePosition.x, { damping: 50, stiffness: 400 });
  const smoothY = useSpring(mousePosition.y, { damping: 50, stiffness: 400 });

  const moveX = useTransform(smoothX, [-0.5, 0.5], [-20, 20]);
  const moveY = useTransform(smoothY, [-0.5, 0.5], [-20, 20]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-5, 5]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30" style={{ perspective: '1000px' }}>
      <motion.svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vh] min-w-[800px] min-h-[800px]"
        viewBox="0 0 1000 1000"
        xmlns="http://www.w3.org/2000/svg"
        style={{ x: moveX, y: moveY, rotateX, rotateY }}
      >
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="var(--color-antique-gold)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-antique-gold)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#glow)" />

        <g stroke="var(--color-antique-gold)" strokeWidth="0.5" fill="none" opacity="0.4">
          <motion.circle
            cx="500" cy="500" r="300"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            strokeDasharray="4 8"
          />
          <motion.circle
            cx="500" cy="500" r="400"
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: -360 }}
            transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
            strokeDasharray="2 10"
          />
          
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 240, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: '500px 500px' }}
          >
            {/* Metatron's Cube subtle lines */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x1 = 500 + 200 * Math.cos(rad);
              const y1 = 500 + 200 * Math.sin(rad);
              const rad2 = ((angle + 60) * Math.PI) / 180;
              const x2 = 500 + 200 * Math.cos(rad2);
              const y2 = 500 + 200 * Math.sin(rad2);
              return (
                <g key={`poly-${i}`}>
                  <line x1="500" y1="500" x2={x1} y2={y1} strokeOpacity="0.3" />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} strokeOpacity="0.5" />
                  <circle cx={x1} cy={y1} r="3" fill="var(--color-antique-gold)" opacity="0.8" />
                </g>
              );
            })}
            
            <polygon 
              points="500,200 760,650 240,650" 
              strokeOpacity="0.2"
            />
            <polygon 
              points="500,800 240,350 760,350" 
              strokeOpacity="0.2"
            />
          </motion.g>
        </g>
      </motion.svg>
    </div>
  );
};
