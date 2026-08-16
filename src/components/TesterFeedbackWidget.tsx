import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Check, Send, Sparkles } from 'lucide-react';
import { TesterFeedback } from '../types';

interface TesterFeedbackWidgetProps {
  onFeedbackSubmitted?: (fb: TesterFeedback) => void;
}

export function TesterFeedbackWidget({ onFeedbackSubmitted }: TesterFeedbackWidgetProps) {
  const [score, setScore] = useState<number | null>(null);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [recognizeMotifs, setRecognizeMotifs] = useState('');
  const [helpedSeeDifferently, setHelpedSeeDifferently] = useState('');
  const [feelsPersonalOrGeneric, setFeelsPersonalOrGeneric] = useState('');
  const [wantsContinuation, setWantsContinuation] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === null) return;

    setIsSubmitting(true);
    setSubmitError('');
    const feedbackPayload: TesterFeedback = {
      score,
      recognizeMotifs,
      helpedSeeDifferently,
      feelsPersonalOrGeneric,
      wantsContinuation,
      comment,
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackPayload)
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'ok') throw new Error('feedback_not_saved');
      setSubmitted(true);
      if (onFeedbackSubmitted) onFeedbackSubmitted(feedbackPayload);
    } catch (err) {
      console.error(err);
      setSubmitError('Не удалось сохранить отклик. Попробуйте ещё раз позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="w-full bg-[#111A16] border border-[#2A3B33] p-6 text-center rounded-xs mt-12">
        <div className="w-10 h-10 rounded-full bg-[#1A2621] text-[#A3B8AD] flex items-center justify-center mx-auto mb-3">
          <Check size={20} />
        </div>
        <h4 className="font-serif text-lg text-[#EAEAEA] mb-1">Спасибо за ваш отклик</h4>
        <p className="text-xs text-gray-400">Ваша обратная связь помогает настроить чуткость и точность языка системы.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#111A16] border border-[#2A3B33] p-6 sm:p-8 rounded-xs mt-12 text-left">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-[#A3B8AD]" />
        <span className="text-[11px] uppercase tracking-widest text-[#A3B8AD]">Необязательный отклик после опыта</span>
      </div>
      <h3 className="font-serif text-xl text-[#F4F4F4] mb-2">
        Насколько Встреча зеркал оказалась про вас?
      </h3>
      <p className="text-xs text-gray-400 mb-6">
        Это post-release evidence, а не условие доступа к продукту. Оцените от 0 (совсем мимо) до 10 (точное узнавание):
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* 0-10 Scale */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-between items-center">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setScore(val)}
              onMouseEnter={() => setHoverScore(val)}
              onMouseLeave={() => setHoverScore(null)}
              className={`w-8 h-9 sm:w-10 sm:h-10 text-xs sm:text-sm font-sans transition-all flex items-center justify-center border rounded-xs ${
                score === val
                  ? 'bg-[#A3B8AD] text-[#0F1412] font-bold border-[#A3B8AD]'
                  : (hoverScore !== null && hoverScore >= val)
                    ? 'bg-[#1A2621] text-[#EAEAEA] border-[#40564A]'
                    : 'bg-[#0F1412] text-gray-400 border-[#2A3B33] hover:border-[#40564A]'
              }`}
            >
              {val}
            </button>
          ))}
        </div>

        {/* Short optional questions appear once rating is selected */}
        <AnimatePresence>
          {score !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-5 pt-4 border-t border-[#23332A]"
            >
              {/* Q1 */}
              <div>
                <label className="text-xs text-gray-300 block mb-2">
                  Вы узнаёте в истории свои собственные образы?
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Да, очень точно', 'Частично', 'Скорее нет'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRecognizeMotifs(opt)}
                      className={`px-3 py-1.5 text-xs rounded-xs border transition-all ${
                        recognizeMotifs === opt
                          ? 'bg-[#1A2621] border-[#A3B8AD] text-[#EAEAEA]'
                          : 'bg-[#0F1412] border-[#2A3B33] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2 */}
              <div>
                <label className="text-xs text-gray-300 block mb-2">
                  Помогла ли история увидеть что-то немного иначе?
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Да, дала новый ракурс', 'Пока размышляю', 'Нет, ничего нового'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setHelpedSeeDifferently(opt)}
                      className={`px-3 py-1.5 text-xs rounded-xs border transition-all ${
                        helpedSeeDifferently === opt
                          ? 'bg-[#1A2621] border-[#A3B8AD] text-[#EAEAEA]'
                          : 'bg-[#0F1412] border-[#2A3B33] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3 */}
              <div>
                <label className="text-xs text-gray-300 block mb-2">
                  Это ощущается вашей личной историей или красивым универсальным текстом?
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Личной историей', 'Универсальным текстом', 'Смешанное чувство'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFeelsPersonalOrGeneric(opt)}
                      className={`px-3 py-1.5 text-xs rounded-xs border transition-all ${
                        feelsPersonalOrGeneric === opt
                          ? 'bg-[#1A2621] border-[#A3B8AD] text-[#EAEAEA]'
                          : 'bg-[#0F1412] border-[#2A3B33] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q4 */}
              <div>
                <label className="text-xs text-gray-300 block mb-2">
                  Хочется ли вам продолжить исследование через другие зеркала?
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Да, интересно сопоставить с Кодом', 'Возможно позже', 'Пока достаточно'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWantsContinuation(opt)}
                      className={`px-3 py-1.5 text-xs rounded-xs border transition-all ${
                        wantsContinuation === opt
                          ? 'bg-[#1A2621] border-[#A3B8AD] text-[#EAEAEA]'
                          : 'bg-[#0F1412] border-[#2A3B33] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Freeform Comment */}
              <div>
                <label className="text-xs text-gray-300 block mb-2">
                  Что особенно отозвалось или, наоборот, показалось лишним? (необязательно)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ваши впечатления, слова или замечания к языку..."
                  className="w-full bg-[#0F1412] border border-[#2A3B33] text-gray-200 text-xs p-3 outline-none focus:border-[#A3B8AD] resize-none h-20 rounded-xs placeholder:text-gray-600"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-[#A3B8AD] text-[#0F1412] uppercase tracking-widest text-xs font-semibold hover:bg-[#8CA296] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={13} />
                <span>{isSubmitting ? 'Отправка...' : 'Отправить отклик'}</span>
              </button>
              {submitError && <p role="alert" className="text-xs text-red-300">{submitError}</p>}
            </motion.div>
          )}
        </AnimatePresence>

      </form>
    </div>
  );
}
