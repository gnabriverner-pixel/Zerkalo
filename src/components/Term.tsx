import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import {
  GlossaryEntry,
  findGlossaryEntryByTerm,
  GLOSSARY_PLANETS,
  GLOSSARY_ROLES,
  ALL_GLOSSARY_ENTRIES
} from '../data/glossary';

export interface TermProps {
  children?: React.ReactNode;
  term?: string;
  planet?: number;
  role?: string;
  entry?: GlossaryEntry;
  className?: string;
}

export const Term: React.FC<TermProps> = ({
  children,
  term,
  planet,
  role,
  entry: explicitEntry,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const entry: GlossaryEntry | undefined =
    explicitEntry ||
    (planet ? GLOSSARY_PLANETS[planet] : undefined) ||
    (role ? GLOSSARY_ROLES[role] : undefined) ||
    (term ? findGlossaryEntryByTerm(term) : undefined);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!entry) {
    return <span className={className}>{children || term}</span>;
  }

  const displayText = children || term || entry.title;

  return (
    <span ref={containerRef} className="relative inline-block align-baseline">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Что это такое?"
        className={`inline cursor-help border-b border-dotted border-[var(--color-antique-gold)]/80 text-inherit hover:text-[var(--color-antique-gold)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-antique-gold)] transition-colors duration-150 p-0 bg-transparent text-left font-inherit ${className}`}
      >
        {displayText}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Sheet Backdrop & Dialog (screens <= 640px) */}
            <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                role="dialog"
                aria-modal="true"
                aria-label={entry.title}
                className="w-full bg-[#0D121D] border-t border-[var(--color-border-gold)]/60 rounded-t-xl p-5 shadow-2xl text-left"
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10 mb-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono block mb-1">
                      Подсказка к термину
                    </span>
                    <h4 className="font-serif text-xl text-stone-100 font-light">
                      {entry.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-stone-400 hover:text-white transition-colors cursor-pointer rounded-full min-w-[36px] min-h-[36px] flex items-center justify-center"
                    aria-label="Закрыть"
                  >
                    <X size={18} />
                  </button>
                </div>

                <p className="text-[14px] text-stone-200 leading-relaxed font-normal mb-5">
                  {entry.text}
                </p>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 bg-[var(--color-antique-gold)] text-gray-950 text-[12px] font-semibold uppercase tracking-[0.16em] rounded-xs cursor-pointer text-center"
                >
                  Понятно
                </button>
              </motion.div>
            </div>

            {/* Desktop Popover Tooltip (screens > 640px) */}
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              role="dialog"
              aria-modal="false"
              aria-label={entry.title}
              className="hidden sm:block absolute left-0 bottom-full mb-2 w-80 max-w-[calc(100vw-32px)] z-40 bg-[#0D121D] border border-[var(--color-border-gold)]/70 rounded-xs p-4 shadow-[0_12px_36px_rgba(0,0,0,0.6)] text-left"
            >
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10 mb-2">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-mono block">
                    Подсказка
                  </span>
                  <h4 className="font-serif text-lg text-stone-100 font-light leading-snug">
                    {entry.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="p-1 text-stone-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Закрыть"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-[13px] text-stone-200 leading-relaxed font-normal">
                {entry.text}
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
};

// Helper to annotate first occurrences of glossary terms in story text
export function renderTextWithTerms(text: string, seenTerms: Set<string>): React.ReactNode[] {
  // Collect terms to match (prioritize specific planet names like Раху, Кету, Сатурн, etc.)
  const regex = /\b(Раху|Кету|Солнц[еауе]|Солнцем|Луна|Луны|Луне|Луну|Луной|Юпитер[ауе]?|Юпитером|Меркури[йяюе]|Меркурием|Венер[аыеу]|Венерой|Сатурн[ауе]?|Сатурном|Марс[ауе]?|Марсом|Сурь[яеи]|Чандр[аые]|Будх[аые]|Шукр[аые]|Шани|Мангал[аые]|Гуру)\b/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchedWord = match[0];
    const matchStart = match.index;
    const matchEnd = matchStart + matchedWord.length;

    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    const entry = findGlossaryEntryByTerm(matchedWord);
    if (entry && !seenTerms.has(entry.id)) {
      seenTerms.add(entry.id);
      parts.push(
        <Term key={`term-${entry.id}-${matchStart}`} entry={entry}>
          {matchedWord}
        </Term>
      );
    } else {
      parts.push(matchedWord);
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default Term;
