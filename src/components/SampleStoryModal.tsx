import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, BookOpen } from 'lucide-react';
import { SAMPLE_MYTH } from '../data/storySample';

interface SampleStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SampleStoryModal: React.FC<SampleStoryModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#06090F]/85 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sample-modal-title"
            className="relative w-full max-w-2xl bg-[#0D121D] border border-[var(--color-border-gold)] rounded-sm p-6 sm:p-9 text-left shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_24px_rgba(200,164,93,0.12)] max-h-[88vh] overflow-y-auto z-10 custom-scrollbar"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Закрыть образец"
              className="absolute top-5 right-5 p-2 text-stone-400 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/5"
            >
              <X size={20} />
            </button>

            {/* Badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_6px_rgba(200,164,93,0.6)]" />
              <span className="text-[11px] sm:text-xs uppercase font-sans tracking-[0.22em] text-[var(--color-antique-gold)] font-medium">
                {SAMPLE_MYTH.subtitle}
              </span>
            </div>

            {/* Title */}
            <h2 id="sample-modal-title" className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#F2EFE9] font-light leading-tight mb-4">
              {SAMPLE_MYTH.title}
            </h2>

            {/* Disclaimer */}
            <p className="text-xs text-[#94A3B8] border-l-2 border-[var(--color-border-gold)] pl-3 py-1 mb-6 leading-relaxed">
              {SAMPLE_MYTH.disclaimer}
            </p>

            {/* Story Text */}
            <div className="space-y-4 text-[15px] sm:text-base text-[#D1D5DB] font-normal leading-[1.75] border-b border-white/10 pb-8">
              {SAMPLE_MYTH.paragraphs.map((p, i) => (
                <p key={i} className="first-letter:font-serif first-letter:text-2xl first-letter:text-[var(--color-antique-gold)] first-letter:mr-0.5">
                  {p}
                </p>
              ))}
            </div>

            {/* Mirror Reflections */}
            <div className="mt-8 border-b border-white/10 pb-8">
              <h3 className="font-serif text-xl sm:text-2xl text-[var(--color-antique-gold)] font-light mb-4">
                Зеркало — взгляд со стороны
              </h3>
              <div className="space-y-3.5 text-sm leading-relaxed">
                <div className="p-3.5 rounded-xs bg-[#111723]/60 border border-white/5">
                  <span className="text-xs uppercase tracking-wider text-[var(--color-antique-gold)] block mb-1 font-medium">Главный образ</span>
                  <p className="text-[#E2E8F0]">{SAMPLE_MYTH.mirror.mainImage}</p>
                </div>
                <div className="p-3.5 rounded-xs bg-[#111723]/60 border border-white/5">
                  <span className="text-xs uppercase tracking-wider text-[var(--color-antique-gold)] block mb-1 font-medium">Внутреннее напряжение</span>
                  <p className="text-[#E2E8F0]">{SAMPLE_MYTH.mirror.innerTension}</p>
                </div>
                <div className="p-3.5 rounded-xs bg-[#111723]/60 border border-white/5">
                  <span className="text-xs uppercase tracking-wider text-[var(--color-antique-gold)] block mb-1 font-medium">Скрытый ресурс</span>
                  <p className="text-[#E2E8F0]">{SAMPLE_MYTH.mirror.hiddenResource}</p>
                </div>
                <div className="p-3.5 rounded-xs bg-[#111723]/60 border border-white/5">
                  <span className="text-xs uppercase tracking-wider text-[var(--color-antique-gold)] block mb-1 font-medium">Новый взгляд</span>
                  <p className="text-[#E2E8F0]">{SAMPLE_MYTH.mirror.newView}</p>
                </div>
              </div>
            </div>

            {/* Meanings & Guidance */}
            <div className="mt-8 border-b border-white/10 pb-8 space-y-5">
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-medium mb-2.5">
                  Возможные смыслы
                </h4>
                <ul className="list-disc list-inside text-sm text-[#CBD5E1] space-y-1">
                  {SAMPLE_MYTH.meaning.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-medium mb-1.5">
                  Один простой шаг
                </h4>
                <p className="text-sm text-[#E2E8F0] leading-relaxed">
                  {SAMPLE_MYTH.one_step}
                </p>
              </div>

              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-[var(--color-antique-gold)] font-medium mb-1.5">
                  Вопрос для дневника
                </h4>
                <p className="text-sm italic text-[#E0C693] leading-relaxed">
                  «{SAMPLE_MYTH.journal_question}»
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <a
                href="/api/stories-sample/pdf"
                download="synthetic-story-sample.pdf"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xs border border-[var(--color-border-gold)] bg-[var(--color-antique-gold)]/15 hover:bg-[var(--color-antique-gold)]/25 text-[var(--color-antique-gold)] text-xs uppercase tracking-wider font-semibold text-center transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>Скачать PDF образца</span>
              </a>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 text-xs uppercase tracking-wider text-stone-300 hover:text-white transition-colors cursor-pointer text-center"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
