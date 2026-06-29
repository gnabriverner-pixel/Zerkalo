import React from 'react';
import { FirstMirror } from '../types';
import { motion } from 'motion/react';

interface Props {
  data: FirstMirror;
  onCtaClick: () => void;
}

const GreekDivider = () => (
  <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto my-8 opacity-40">
    <path d="M0 6H10V1H20V11H30V6H40V1H50V11H60V6H70V1H80V11H90V6H100V1H110V11H120" stroke="var(--color-antique-gold)" strokeWidth="0.5" strokeMiterlimit="10"/>
  </svg>
);

export const FirstMirrorPanel: React.FC<Props> = ({ data, onCtaClick }) => {
  // Safe fallbacks to prevent React crashes
  const subtitle = data?.subtitle || "Архитектура Силы";
  const formulaNumbers = data?.formula?.numbers || "";
  const formulaPlanets = data?.formula?.planets || "";
  const formulaPositions = data?.formula?.positions || "";
  const keyInsight = data?.keyInsight || "";
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const strengthTags = Array.isArray(data?.strengthTags) ? data.strengthTags : [];
  const tensionTags = Array.isArray(data?.tensionTags) ? data.tensionTags : [];
  const ctaTitle = data?.cta?.title || "Хотите получить детальный разбор?";
  const ctaText = data?.cta?.text || "Более детальный разбор доступен в Telegram.";
  const ctaButton = data?.cta?.button || "Получить разбор в Telegram";
  const disclaimer = data?.disclaimer || "Информационно-аналитический формат.";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-ivory)] border-x border-y border-[var(--border-soft)] w-full max-w-4xl mx-auto my-12 relative"
      style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.03)' }}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-40"></div>
      
      <div className="p-8 md:p-14 lg:p-20">
        <div className="text-center mb-14">
          <p className="text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-antique-gold)] mb-6 font-sans">
            Первое Зеркало
          </p>
          <h2 className="text-3xl md:text-5xl font-serif text-[var(--color-ink)] mb-10 tracking-tight">
            {subtitle}
          </h2>
          
          <GreekDivider />
          
          <div className="mt-10 mb-6">
            <h3 className="text-[0.65rem] tracking-[0.25em] uppercase text-[var(--color-muted)] mb-4 font-sans">
              Архитектура Формулы
            </h3>
            <div className="inline-block border border-[var(--color-antique-gold)] border-opacity-30 p-6 md:p-8 bg-transparent">
              <div className="text-2xl md:text-3xl font-serif tracking-[0.15em] text-[var(--color-ink)] mb-3">
                {formulaNumbers}
              </div>
              <div className="text-[0.8rem] md:text-sm font-sans tracking-[0.15em] text-[var(--color-graphite)] mb-3 uppercase">
                {formulaPlanets}
              </div>
              <div className="text-[0.65rem] tracking-[0.2em] text-[var(--color-muted)] uppercase opacity-80">
                {formulaPositions}
              </div>
            </div>
          </div>
        </div>

        {keyInsight && (
          <div className="border-l-2 border-[var(--color-antique-gold)] pl-8 py-2 md:py-4 mb-16 mx-4 md:mx-0">
            <p className="text-xl md:text-3xl font-serif italic text-[var(--color-ink)] leading-relaxed">
              "{keyInsight}"
            </p>
          </div>
        )}

        {blocks.length > 0 && (
          <div className="space-y-16 mt-16">
            {blocks.map((block) => (
              <div key={block.id} className="relative">
                <h3 className="text-[0.7rem] tracking-[0.25em] uppercase text-[var(--color-antique-gold)] font-sans mb-4 inline-block bg-[var(--color-ivory)] px-2 -ml-2">
                  {block.title}
                </h3>
                <p className="font-serif text-[1.1rem] md:text-[1.25rem] leading-[1.8] text-[var(--color-graphite)] text-justify">
                  {block.text}
                </p>
              </div>
            ))}
          </div>
        )}

        <GreekDivider />

        {(strengthTags.length > 0 || tensionTags.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px mt-16 bg-[var(--border-soft)] border border-[var(--border-soft)]">
            <div className="bg-[var(--color-surface)] p-8 md:p-10">
              <h4 className="text-[0.7rem] font-sans tracking-[0.2em] uppercase text-[var(--color-ink)] mb-6 border-b border-[var(--border-soft)] pb-4">Фундамент</h4>
              <div className="flex flex-col gap-3">
                {strengthTags.map((tag, i) => (
                  <span key={i} className="font-serif text-sm text-[var(--color-graphite)] leading-relaxed relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.55rem] before:w-1.5 before:h-1.5 before:bg-[var(--color-antique-gold)] before:opacity-60">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-[var(--color-ivory)] p-8 md:p-10">
              <h4 className="text-[0.7rem] font-sans tracking-[0.2em] uppercase text-[var(--color-ink)] mb-6 border-b border-[var(--border-soft)] pb-4">Точки давления</h4>
              <div className="flex flex-col gap-3">
                {tensionTags.map((tag, i) => (
                  <span key={i} className="font-serif text-sm text-[var(--color-graphite)] leading-relaxed relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.55rem] before:w-1.5 before:h-1.5 before:bg-[var(--color-muted)] before:opacity-40">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-24 text-center">
          <h3 className="text-3xl font-serif text-[var(--color-ink)] mb-6">{ctaTitle}</h3>
          <p className="font-sans text-[var(--color-graphite)] text-sm max-w-xl mx-auto mb-10 leading-relaxed tracking-wide">
            {ctaText}
          </p>
          <button 
            onClick={onCtaClick}
            className="px-10 py-5 bg-[var(--color-ink)] text-[var(--color-ivory)] font-sans text-[0.7rem] tracking-[0.3em] uppercase hover:bg-black transition-all border border-transparent hover:border-[var(--color-antique-gold)] duration-300 cursor-pointer"
          >
            {ctaButton}
          </button>
        </div>
      </div>
      
      <div className="bg-[#f2f0e9] py-6 px-4 text-center border-t border-[var(--border-soft)]">
         <p className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-muted)] opacity-60">
           {disclaimer}
         </p>
      </div>
    </motion.div>
  );
};
