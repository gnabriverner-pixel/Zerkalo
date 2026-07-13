import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, X } from 'lucide-react';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: string;
  defaultBirthDate?: string;
  theme?: 'light' | 'dark';
}

export const LeadModal: React.FC<LeadModalProps> = ({ 
  isOpen, 
  onClose, 
  source, 
  defaultBirthDate = '', 
  theme = 'dark' 
}) => {
  const [leadForm, setLeadForm] = useState({ name: '', birthDate: defaultBirthDate, contact: '', request: '' });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [leadMessage, setLeadMessage] = useState('');

  // Update birthDate if defaultBirthDate changes, only if form is untouched ideally, 
  // but let's just initialize it on open using useEffect.
  React.useEffect(() => {
    if (isOpen) {
      setLeadForm(prev => ({ ...prev, birthDate: defaultBirthDate }));
      setLeadStatus('idle');
      setLeadMessage('');
    }
  }, [isOpen, defaultBirthDate]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadStatus('submitting');
    setLeadMessage('');

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          source
        })
      });

      const data = await res.json();

      if (data.status === 'ok') {
        setLeadStatus('success');
        setLeadMessage(data.ui?.safe_message || 'Заявка принята. Я свяжусь с вами и уточню, какой вопрос важно разобрать.');
      } else {
        setLeadStatus('error');
        setLeadMessage(data.ui?.safe_message || 'Пожалуйста, проверьте данные и попробуйте ещё раз.');
      }
    } catch (err) {
      setLeadStatus('error');
      setLeadMessage('Произошла ошибка при отправке. Пожалуйста, проверьте данные и попробуйте ещё раз.');
    }
  };

  const isDark = theme === 'dark';
  const overlayBg = isDark ? 'bg-[#0F1412]/90' : 'bg-[#FAFAFA]/90';
  const modalBg = isDark ? 'bg-[#111A16] border-[#2A3B33]' : 'bg-[var(--color-marble)] border-[var(--border-soft)]';
  const textInk = isDark ? 'text-[#EAEAEA]' : 'text-[var(--color-ink)]';
  const textMuted = isDark ? 'text-[var(--color-muted)]' : 'text-[var(--color-muted)]';
  const borderInput = isDark ? 'border-[#2A3B33] focus:border-[#A3B8AD]' : 'border-[var(--color-border)] focus:border-[var(--color-antique-gold)]';
  const textInput = isDark ? 'text-[#EAEAEA] placeholder:text-[#3A4B43]' : 'text-[var(--color-ink)] placeholder:text-[var(--color-muted)]';
  const focusBorder = isDark ? 'focus:border-[#A3B8AD]' : 'focus:border-[var(--color-antique-gold)]';
  const primaryBtnText = isDark ? 'text-[#0F1412]' : 'text-[var(--color-ivory)]';
  const primaryBtnBg = isDark ? 'bg-[#A3B8AD] hover:bg-[#8CA296]' : 'bg-[var(--color-ink)] hover:bg-black';
  const errorBg = isDark ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-red-50 text-red-700 border-red-100';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${overlayBg}`}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className={`p-8 md:p-12 max-w-md w-full relative shadow-2xl border ${modalBg}`}
          >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isDark ? 'via-[#A3B8AD]' : 'via-[var(--color-antique-gold)]'} to-transparent opacity-30`}></div>
            <button 
              onClick={onClose}
              className={`absolute top-6 right-6 transition-colors ${isDark ? 'text-gray-500 hover:text-[#A3B8AD]' : 'text-[var(--color-muted)] hover:text-[var(--color-antique-gold)]'}`}
            >
              <X className="w-6 h-6" strokeWidth={1} />
            </button>
            
            <h3 className={`font-serif text-3xl mb-4 ${textInk}`}>Разбор вашего вопроса</h3>
            <p className={`font-sans text-[0.95rem] mb-8 leading-relaxed ${textMuted}`}>
              Оставьте заявку, если хотите обсудить один важный вопрос и получить персональный разбор.
            </p>
            
            {leadStatus === 'success' ? (
              <div className={`border p-8 text-center font-serif text-[1.1rem] ${isDark ? 'bg-[#1A2621]/30 border-[#2A3B33] text-[#A3B8AD]' : 'bg-[var(--color-ivory)] border-[var(--border-soft)] text-[var(--color-ink)]'}`}>
                <p>{leadMessage}</p>
                <button 
                  onClick={onClose}
                  className={`mt-8 px-8 py-3 font-sans text-xs tracking-[0.15em] uppercase transition-colors ${primaryBtnBg} ${primaryBtnText}`}
                >
                  Закрыть
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="flex flex-col gap-5">
                <input 
                  type="text" 
                  placeholder="Ваше имя" 
                  required
                  value={leadForm.name}
                  onChange={e => setLeadForm({...leadForm, name: e.target.value})}
                  className={`w-full bg-transparent border-b p-4 font-serif text-lg outline-none transition-colors ${borderInput} ${textInput} ${focusBorder}`}
                />
                <input 
                  type="text" 
                  placeholder="Ваш контакт (Telegram, Email...)" 
                  required
                  value={leadForm.contact}
                  onChange={e => setLeadForm({...leadForm, contact: e.target.value})}
                  className={`w-full bg-transparent border-b p-4 font-serif text-lg outline-none transition-colors ${borderInput} ${textInput} ${focusBorder}`}
                />
                <input 
                  type="text" 
                  placeholder="Дата рождения для разбора"
                  required
                  value={leadForm.birthDate}
                  onChange={e => setLeadForm({...leadForm, birthDate: e.target.value})}
                  className={`w-full bg-transparent border-b p-4 font-serif text-lg outline-none transition-colors ${borderInput} ${textInput} ${focusBorder}`}
                />
                <textarea 
                  placeholder="Короткий запрос (необязательно)" 
                  rows={3}
                  value={leadForm.request}
                  onChange={e => setLeadForm({...leadForm, request: e.target.value})}
                  className={`w-full bg-transparent border-b p-4 font-serif text-lg outline-none transition-colors resize-none mt-2 ${borderInput} ${textInput} ${focusBorder}`}
                ></textarea>
                
                <div className="pt-2 flex items-center justify-start gap-3 w-full">
                  <input 
                    type="checkbox" 
                    id="lead_consent" 
                    required
                    className={`w-4 h-4 cursor-pointer accent-[var(--color-antique-gold)]`}
                  />
                  <label htmlFor="lead_consent" className={`text-[10px] sm:text-xs cursor-pointer select-none left-0 ${textMuted}`}>
                     Я согласен с положениями <a href="/privacy.html" target="_blank" className="underline hover:text-[var(--color-antique-gold)]">Политикой обработки персональных данных</a>
                  </label>
                </div>

                {leadStatus === 'error' && (
                  <div className={`p-3 text-sm font-sans mt-2 border ${errorBg}`}>{leadMessage}</div>
                )}
                
                <button 
                  type="submit" 
                  disabled={leadStatus === 'submitting'}
                  className={`mt-4 w-full py-5 font-sans text-xs tracking-[0.15em] uppercase transition-colors disabled:opacity-50 flex justify-center items-center ${primaryBtnBg} ${primaryBtnText}`}
                >
                  {leadStatus === 'submitting' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Отправить заявку'}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
