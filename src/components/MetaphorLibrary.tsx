import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2 } from 'lucide-react';

export const MetaphorLibrary = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [savedItems, setSavedItems] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      setSavedItems(JSON.parse(localStorage.getItem('saved_metaphors') || '[]'));
    };
    if (isOpen) load();
    window.addEventListener('metaphor_saved', load);
    return () => window.removeEventListener('metaphor_saved', load);
  }, [isOpen]);

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
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#FAFAFA] bg-marble shadow-2xl z-[10000] overflow-y-auto border-l border-[var(--color-antique-gold)]/20 flex flex-col"
          >
            <div className="p-6 border-b border-[var(--color-antique-gold)]/20 flex justify-between items-center sticky top-0 bg-[#FAFAFA]/90 backdrop-blur-md z-10">
              <h2 className="font-serif text-2xl text-[var(--color-ink)]">Библиотека Метафор</h2>
              <button onClick={onClose} className="p-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-grow flex flex-col gap-6">
              {savedItems.length === 0 ? (
                <div className="text-center text-[var(--color-muted)] font-sans text-sm mt-10 opacity-70">
                  Ваша библиотека пока пуста.<br/>Сохраняйте цитаты и инсайты, чтобы возвращаться к ним.
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
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-muted)] hover:text-red-900/70"
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
