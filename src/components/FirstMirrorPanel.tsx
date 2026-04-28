import React from 'react';
import { FirstMirror } from '../types';
import { motion } from 'motion/react';

interface Props {
  data: FirstMirror;
  onCtaClick: () => void;
}

export const FirstMirrorPanel: React.FC<Props> = ({ data, onCtaClick }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-ivory)] border border-[var(--border-soft)] rounded-md overflow-hidden max-w-4xl mx-auto my-12"
      style={{ boxShadow: 'var(--shadow-luxury)' }}
    >
      <div className="p-8 md:p-12">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.25em] uppercase text-[var(--color-muted)] mb-4 font-sans">
            Первое Зеркало
          </p>
          <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-ink)] mb-6">
            {data.subtitle}
          </h2>
          
          <div className="inline-block border border-[var(--border-soft)] p-4 bg-[var(--color-warm-paper)] rounded mx-auto">
             <div className="text-xl font-serif tracking-widest text-[var(--color-ink)] mb-1">
               {data.formula.numbers}
             </div>
             <div className="text-sm font-sans tracking-wide text-[var(--color-muted)] mb-1">
               {data.formula.planets}
             </div>
             <div className="text-xs text-[var(--color-muted)] opacity-70">
               {data.formula.positions}
             </div>
          </div>
        </div>

        <div className="border-l-2 border-[var(--color-antique-gold)] pl-6 mb-12">
          <p className="text-xl md:text-2xl font-serif italic text-[var(--color-graphite)] leading-relaxed">
            "{data.keyInsight}"
          </p>
        </div>

        <div className="space-y-10">
          {data.blocks.map((block) => (
            <div key={block.id} className="relative">
              <h3 className="text-sm tracking-[0.15em] uppercase text-[var(--color-muted)] font-sans mb-3 border-b border-[var(--border-soft)] pb-2 inline-block">
                {block.title}
              </h3>
              <p className="font-serif text-[1.15rem] leading-[1.8] text-[var(--color-ink)]">
                {block.text}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 bg-[var(--color-warm-paper)] p-6 md:p-8 rounded-sm border border-[var(--border-soft)]">
          <div>
            <h4 className="text-sm font-sans tracking-widest uppercase text-[var(--color-ink)] mb-4">Светлые стороны</h4>
            <div className="flex flex-wrap gap-2">
              {data.strengthTags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-[var(--color-ivory)] border border-[var(--border-soft)] text-xs text-[var(--color-ink)] rounded-full">
                  {tag.trim()}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-sans tracking-widest uppercase text-[var(--color-ink)] mb-4">Зоны напряжения</h4>
            <div className="flex flex-wrap gap-2">
              {data.tensionTags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-[var(--color-ivory)] border border-[var(--border-soft)] text-xs text-[var(--color-ink)] rounded-full">
                  {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-16 text-center border-t border-[var(--border-soft)] pt-12">
          <h3 className="text-2xl font-serif text-[var(--color-ink)] mb-4">{data.cta.title}</h3>
          <p className="font-sans text-[var(--color-muted)] text-sm max-w-xl mx-auto mb-8 leading-relaxed">
            {data.cta.text}
          </p>
          <button 
            onClick={onCtaClick}
            className="px-8 py-4 bg-[var(--color-ink)] text-[var(--color-ivory)] font-sans text-sm tracking-widest uppercase hover:bg-black transition-colors rounded-sm"
          >
            {data.cta.button}
          </button>
        </div>
      </div>
      
      <div className="bg-[var(--color-warm-paper)] p-4 text-center border-t border-[var(--border-soft)]">
         <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] opacity-60">
           {data.disclaimer}
         </p>
      </div>
    </motion.div>
  );
};
