import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2 } from 'lucide-react';

export const MetaphorLibrary = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [savedItems, setSavedItems] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      setSavedItems(JSON.parse(localStorage.getItem('saved_metaphors') || '[]'));
    };
    if (isOpen) {
      load();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

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
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-label="Мои заметки"
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#FAFAFA] bg-marble shadow-2xl z-[10000] overflow-y-auto border-l border-[var(--color-antique-gold)]/20 flex flex-col"
          >
            <div className="p-6 border-b border-[var(--color-antique-gold)]/20 flex justify-between items-center sticky top-0 bg-[#FAFAFA]/90 backdrop-blur-md z-10">
              <h2 className="font-serif text-2xl text-[var(--color-ink)]">Мои заметки</h2>
              <button 
                onClick={onClose} 
                className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                aria-label="Закрыть заметки"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-grow flex flex-col gap-6">
              {savedItems.length === 0 ? (
                <div className="text-center text-[var(--color-muted)] font-sans text-sm mt-10 opacity-70">
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
                    className="relative p-6 bg-kraft border border-[var(--color-antique-gold)]/30 rounded-sm group"
                  >
                    <button 
                      onClick={() => remove(item.id)}
                      className="absolute top-3 right-3 min-w-[36px] min-h-[36px] flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity text-[var(--color-muted)] hover:text-red-900/80 cursor-pointer"
                      title="Удалить заметку"
                      aria-label="Удалить заметку"
                    >
                      <Trash2 size={16} />
                    </button>
                    <p className="font-serif text-[1rem] leading-relaxed text-[var(--color-graphite)] italic pr-6">
                      «{item.text}»
                    </p>
                    <div className="mt-4 pt-4 border-t border-[var(--border-soft)] text-xs font-sans uppercase tracking-widest text-[var(--color-muted)] opacity-70 flex justify-between">
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
