import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2 } from 'lucide-react';

export const MetaphorLibrary = ({ isOpen, onClose, returnFocusTo }: { isOpen: boolean, onClose: () => void, returnFocusTo?: HTMLElement | null }) => {
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = () => {
      setSavedItems(JSON.parse(localStorage.getItem('saved_metaphors') || '[]'));
    };
    if (isOpen) {
      load();
      previousActiveElementRef.current = returnFocusTo || document.activeElement as HTMLElement;
      const t = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
        if (e.key === 'Tab') {
          const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(t);
        window.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose, returnFocusTo]);

  useEffect(() => {
    const load = () => {
      setSavedItems(JSON.parse(localStorage.getItem('saved_metaphors') || '[]'));
    };
    window.addEventListener('metaphor_saved', load);
    return () => window.removeEventListener('metaphor_saved', load);
  }, []);

  const remove = (id: string) => {
    const newSaved = savedItems.filter(item => item.id !== id);
    localStorage.setItem('saved_metaphors', JSON.stringify(newSaved));
    setSavedItems(newSaved);
    window.dispatchEvent(new Event('metaphor_saved'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0F1412]/80 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-label="Мои заметки"
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0D121D] text-stone-300 shadow-2xl z-[10000] overflow-y-auto border-l border-[var(--color-antique-gold)]/20 flex flex-col"
          >
            <div className="p-6 border-b border-[var(--color-antique-gold)]/20 flex justify-between items-center gap-4 sticky top-0 bg-[#0D121D] z-10">
              <h2 className="font-serif text-2xl text-[#F2EFE9]">Мои заметки</h2>
              <button 
                ref={closeButtonRef}
                onClick={onClose} 
                className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center text-stone-300 hover:text-[#F2EFE9] transition-colors cursor-pointer"
                aria-label="Закрыть заметки"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-grow flex flex-col gap-6">
              {savedItems.length === 0 ? (
                <div className="text-center text-stone-300 font-sans text-base leading-relaxed mt-10">
                  У вас пока нет сохранённых заметок.<br/>Сохраняйте важные формулировки и инсайты, чтобы возвращаться к ним.
                </div>
              ) : (
                savedItems.map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item.id} 
                    className="relative p-6 bg-white/[0.03] border border-[var(--color-antique-gold)]/30 rounded-sm group [overflow-wrap:anywhere]"
                  >
                    <button 
                      onClick={() => remove(item.id)}
                      className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-300 hover:text-rose-200 transition-colors cursor-pointer"
                      title="Удалить заметку"
                      aria-label="Удалить заметку"
                    >
                      <Trash2 size={16} />
                    </button>
                    <p className="font-serif text-xl leading-relaxed text-[#F2EFE9] italic pr-8">
                      «{item.text}»
                    </p>
                    <div className="mt-4 pt-4 border-t border-white/10 text-xs font-sans text-stone-300 flex flex-wrap justify-between gap-2">
                      <span>{item.date}</span>
                      <span>Энергия Дня • {item.code}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
