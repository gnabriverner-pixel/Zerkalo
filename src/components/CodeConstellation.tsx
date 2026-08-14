import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CalculationResult } from '../types';

export const CodeConstellation = ({ result }: { result: CalculationResult }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Nodes arranged in a pentagram layout
  const nodes = [
    { id: 'soul', label: 'Душа', value: result.soul, x: 50, y: 15 },
    { id: 'path', label: 'Путь', value: result.path, x: 85, y: 40 },
    { id: 'direction', label: 'Направление', value: result.direction, x: 72, y: 80 },
    { id: 'expression', label: 'Выражение', value: result.expression, x: 28, y: 80 },
    { id: 'result', label: 'Результат', value: result.result, x: 15, y: 40 },
  ];

  // All 10 connections for a complete graph (pentagon + pentagram)
  const lines = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], // perimeter
    [0, 2], [0, 3], [1, 3], [1, 4], [2, 4]  // inner star
  ];

  return (
    <div 
      className="w-full flex flex-col items-center mt-12 mb-16"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      <div className="text-center mb-8">
        <h3 className="font-serif text-2xl tracking-[0.15em] uppercase text-[var(--color-ink)] mb-2">Созвездие Кода</h3>
        <div className="h-px w-12 bg-[var(--color-antique-gold)] mx-auto opacity-50 mb-4"></div>
        <p className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Наведите курсор для визуализации связей
        </p>
      </div>

      <div className="relative w-full max-w-md aspect-square bg-[var(--color-ivory)] bg-marble border border-[var(--color-antique-gold)] border-opacity-20 shadow-[inset_0_0_60px_rgba(30,25,18,0.02)] p-6 group rounded-sm transition-all duration-700 hover:shadow-xl hover:border-opacity-40 cursor-pointer overflow-hidden">
        
        {/* Subtle background glow when hovered */}
        <div className={`absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--color-antique-gold)] to-transparent opacity-0 transition-opacity duration-1000 ${isHovered ? 'opacity-5' : ''}`}></div>

        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible relative z-10">
          {/* Lines */}
          {lines.map(([n1, n2], i) => (
            <motion.line
              key={`line-${i}`}
              x1={nodes[n1].x}
              y1={nodes[n1].y}
              x2={nodes[n2].x}
              y2={nodes[n2].y}
              stroke="var(--color-antique-gold)"
              strokeWidth="0.3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ 
                pathLength: isHovered ? 1 : 0, 
                opacity: isHovered ? 0.4 : 0 
              }}
              transition={{ 
                duration: 1.5, 
                ease: "easeInOut", 
                delay: isHovered ? i * 0.1 : 0 
              }}
            />
          ))}

          {/* Nodes */}
          {nodes.map((node, i) => (
            <g key={node.id}>
              {/* Outer pulsing ring */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r="6"
                fill="none"
                stroke="var(--color-antique-gold)"
                strokeWidth="0.2"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ 
                  scale: isHovered ? 2.5 : 0.5, 
                  opacity: isHovered ? [0, 0.5, 0] : 0 
                }}
                transition={{ 
                  duration: 3, 
                  repeat: isHovered ? Infinity : 0, 
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
              
              {/* Core point */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r="2.5"
                fill={isHovered ? 'var(--color-ink)' : 'var(--color-antique-gold)'}
                initial={{ scale: 0.8, opacity: 0.7 }}
                animate={{ 
                  scale: isHovered ? [1, 1.3, 1] : 1,
                  opacity: isHovered ? 1 : 0.7,
                  filter: isHovered ? 'drop-shadow(0 0 3px rgba(212,175,55,0.8))' : 'none'
                }}
                transition={{ 
                  duration: 2, 
                  repeat: isHovered ? Infinity : 0, 
                  delay: i * 0.2 
                }}
              />

              {/* Number Value */}
              <motion.text
                x={node.x}
                y={node.y - 5}
                textAnchor="middle"
                className="font-serif text-[4px] font-medium"
                fill="var(--color-ink)"
                initial={{ opacity: 0, y: 2 }}
                animate={{ 
                  opacity: isHovered ? 1 : 0.7,
                  y: isHovered ? 0 : 2
                }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                {node.value}
              </motion.text>

              {/* Label */}
              <motion.text
                x={node.x}
                y={node.y + 7}
                textAnchor="middle"
                className="font-sans text-[2.5px] uppercase tracking-[0.2em]"
                fill="var(--color-muted)"
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 0.9 : 0.5 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                {node.label}
              </motion.text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
