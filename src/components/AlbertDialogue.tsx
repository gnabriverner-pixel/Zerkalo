import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalculationResult, MeetingOfMirrorsResult, CodeV2Payload, CodeV2AlbertContext } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { loadTruthState, saveTruthState, truthJourneyKey, hasTruthCorrections, TRUTH_CLEARED_EVENT } from '../services/albertTruthState';
import { 
  X, 
  Send, 
  Loader2, 
  User, 
  Compass, 
  AlertCircle,
  RotateCcw
} from 'lucide-react';

interface AlbertDialogueProps {
  isOpen: boolean;
  onClose: () => void;
  calc?: CalculationResult | null;
  storyResult?: any;
  meetingResult?: MeetingOfMirrorsResult | null;
  initialTopic?: string;
  theme?: 'light' | 'dark';
  codeV2Payload?: CodeV2Payload | null;
  codeV2Context?: CodeV2AlbertContext | null;
}

interface Message {
  id: string;
  sender: 'user' | 'albert';
  text: string;
  timestamp: Date;
}

const PRESET_QUESTIONS = [
  'Проверить на моей ситуации',
  'Вот с чем я не согласен',
  'Помоги сделать следующий шаг'
];

export const AlbertDialogue: React.FC<AlbertDialogueProps> = ({
  isOpen,
  onClose,
  calc,
  storyResult,
  meetingResult,
  initialTopic = '',
  theme = 'light',
  codeV2Payload,
  codeV2Context
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const effectiveCalc = calc || (codeV2Payload?.calculation?.five_numbers as any) || null;
  const journeyKey = truthJourneyKey(effectiveCalc, storyResult, meetingResult);
  const truthRef = useRef<{ journey: string; state: any }>({ journey: journeyKey, state: loadTruthState(journeyKey) });
  const truthEpochRef = useRef(0);
  if (truthRef.current.journey !== journeyKey) truthRef.current = { journey: journeyKey, state: loadTruthState(journeyKey) };
  useEffect(() => {
    const clear = () => { truthRef.current.state = undefined; truthEpochRef.current += 1; };
    window.addEventListener(TRUTH_CLEARED_EVENT, clear);
    return () => window.removeEventListener(TRUTH_CLEARED_EVENT, clear);
  }, []);

  const soul = effectiveCalc?.soul || 1;
  const path = effectiveCalc?.path || 1;
  const dir = effectiveCalc?.direction || 1;
  const expr = effectiveCalc?.expression || 1;
  const res = effectiveCalc?.result || 1;

  const soulInfo = numberKnowledge[soul];
  const pathInfo = numberKnowledge[path];

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      const t = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
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
  }, [isOpen, onClose]);

  // Initialize Albert greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      let greeting = '';
      if (codeV2Context) {
        const questionPart = codeV2Context.opening_question
          ? `\n\n«${codeV2Context.opening_question}»`
          : '';
        greeting = `Здравствуйте. ${codeV2Context.opening_statement}${questionPart}\n\nМожем проверить эту связку на вашей ситуации или разобрать деталь, с которой вы не согласны.`;
      } else if (hasTruthCorrections(truthRef.current.state)) {
        greeting = 'Здравствуйте. Продолжим с темы вашего исследования с учётом сделанных уточнений. Какую деталь сейчас важно разобрать?';
      } else if (meetingResult) {
        const questionPart = meetingResult.reflectiveQuestion 
          ? `В сопоставлении зеркал выделился вопрос:\n\n«${meetingResult.reflectiveQuestion}»\n\nМожем проверить его на вашей ситуации или начать с того, что важно вам сейчас.`
          : `В сопоставлении зеркал открылся такой ракурс:\n\n«${meetingResult.albertInsight}»\n\nМожем проверить эту развилку или разобрать то, с чем вы не согласны.`;
        greeting = `Здравствуйте. ${questionPart}`;
      } else if (calc) {
        greeting = `Здравствуйте. Перед нами карта Кода: мотив Души ${soul} и способ действия Пути ${path}.\n\nПроверим это сочетание на конкретной задаче или разберём другую деталь?`;
      } else {
        greeting = `Здравствуйте. Я готов разобрать увиденное в зеркалах. Опишите конкретную ситуацию или вопрос, который хочется исследовать.`;
      }
      setMessages([
        {
          id: '1',
          sender: 'albert',
          text: greeting,
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, meetingResult, calc, soul, path, dir, expr, soulInfo, pathInfo, codeV2Context]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (questionText?: string) => {
    const text = (questionText || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setErrorText(null);
    setLastFailedMessage(null);

    try {
      const truthEpoch = truthEpochRef.current;
      const historyPayload = messages.map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const contextPayload: Record<string, unknown> = {};
      if (meetingResult) {
        contextPayload.meetingSummary = meetingResult.summary;
        contextPayload.confidenceNote = meetingResult.confidenceNote;
        contextPayload.centralQuestion = meetingResult.reflectiveQuestion;
        contextPayload.albertInsight = meetingResult.albertInsight;
        contextPayload.resonances = meetingResult.parallels;
        contextPayload.divergences = meetingResult.divergences;
      }
      if (calc) {
        contextPayload.codeAnchors = {
          numbers: {
            soul: calc.soul,
            path: calc.path,
            direction: calc.direction,
            expression: calc.expression,
            result: calc.result
          }
        };
      }
      if (storyResult) {
        contextPayload.mythAnchors = {
          title: storyResult.title,
          mainImage: storyResult.mirror?.mainImage,
          innerTension: storyResult.mirror?.innerTension,
          hiddenResource: storyResult.mirror?.hiddenResource,
          newView: storyResult.mirror?.newView,
          oneStep: storyResult.one_step
        };
      }
      if (codeV2Payload) {
        contextPayload.codeV2Payload = codeV2Payload;
      }

      const res = await fetch('/api/albert/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          context: contextPayload,
          truthState: truthRef.current.state
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const safeMessage = errJson?.ui?.safe_message || 'Собеседник временно недоступен. Ваши результаты встречи зеркал сохранены — попробуйте повторить запрос.';
        setErrorText(safeMessage);
        setLastFailedMessage(text);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      if (data.truthState && truthEpoch === truthEpochRef.current) {
        truthRef.current.state = data.truthState;
        saveTruthState(journeyKey, data.truthState);
      }
      if (data.status !== 'ok' || !data.message) {
        const safeMessage = data?.ui?.safe_message || 'Не удалось получить ответ. Ваши результаты сохранены — попробуйте повторить запрос.';
        setErrorText(safeMessage);
        setLastFailedMessage(text);
        setIsLoading(false);
        return;
      }

      const albertMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'albert',
        text: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, albertMsg]);
      setIsLoading(false);
    } catch (err) {
      console.error("Albert dialogue request failed:", err);
      setErrorText("Собеседник временно недоступен. Ваши результаты встречи зеркал сохранены — попробуйте повторить запрос.");
      setLastFailedMessage(text);
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage);
    }
  };

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Диалог с Альбертом Вяземским"
          className={`relative w-full max-w-3xl h-[85vh] flex flex-col rounded-sm shadow-2xl z-10 overflow-hidden border ${
            isDark 
              ? 'bg-[#0F1412] text-[#EAEAEA] border-[#2A3B33]' 
              : 'bg-[#FCFAF6] text-[#1A1A1A] border-[#E8DFC8]'
          }`}
        >
          {/* Header */}
          <div className={`p-5 sm:p-6 flex items-center justify-between border-b ${
            isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-[var(--color-antique-gold)] flex items-center justify-center bg-[var(--color-antique-gold)]/10 text-[var(--color-antique-gold)]">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] tracking-[0.25em] uppercase font-sans text-[var(--color-antique-gold)]">
                  Собеседник и Проводник
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-normal">
                  Альберт Вяземский
                </h3>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Закрыть диалог"
              className={`min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                isDark 
                  ? 'text-stone-400 hover:text-white hover:bg-[#1A2621]' 
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Formula Context Strip */}
          {calc && (
            <div className={`px-6 py-2 border-b flex items-center justify-between text-xs font-sans tracking-widest uppercase opacity-80 ${
              isDark ? 'border-[#2A3B33] bg-[#111A16] text-[#A3B8AD]' : 'border-[#EAE3D2] bg-white text-[var(--color-muted)]'
            }`}>
              <span>Душа: {soul} ({soulInfo?.planet.split(' ')[0] || ''})</span>
              <span>Путь: {calc.pathComposite || calc.path}</span>
              <span>Направление: {dir}</span>
              <span>Итог: {res}</span>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'albert' && (
                  <div className="w-8 h-8 rounded-full border border-[var(--color-antique-gold)] flex items-center justify-center shrink-0 text-[10px] font-serif bg-[var(--color-antique-gold)]/10 text-[var(--color-antique-gold)]">
                    АВ
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 rounded-sm font-serif text-sm sm:text-base leading-relaxed whitespace-pre-line shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-[var(--color-antique-gold)] text-white font-sans'
                      : isDark
                        ? 'bg-[#141C18] border border-[#2A3B33] text-[#EAEAEA]'
                        : 'bg-white border border-[#E8DFC8] text-[#1A1A1A]'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-stone-700 text-white flex items-center justify-center shrink-0 text-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs tracking-wider uppercase font-sans text-[var(--color-antique-gold)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Альберт сверяется со смысловыми узлами зеркал...</span>
              </div>
            )}

            {errorText && (
              <div className={`p-4 rounded-sm border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm ${
                isDark ? 'bg-amber-950/30 border-amber-800/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-antique-gold)]" />
                  <span>{errorText}</span>
                </div>
                {lastFailedMessage && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans uppercase tracking-wider rounded-sm bg-[var(--color-antique-gold)]/20 hover:bg-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] border border-[var(--color-antique-gold)]/40 transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Повторить</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Prompts */}
          <div className={`px-6 py-3 border-t overflow-x-auto flex gap-2 no-scrollbar ${
            isDark ? 'border-[#2A3B33] bg-[#111A16]' : 'border-[#EAE3D2] bg-[#FAF8F5]'
          }`}>
            {PRESET_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={isLoading}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all text-left disabled:opacity-50 ${
                  isDark 
                    ? 'border-[#2A3B33] text-[#A3B8AD] hover:border-[var(--color-antique-gold)] hover:text-white' 
                    : 'border-[#EAE3D2] text-stone-600 hover:border-[var(--color-antique-gold)] hover:text-stone-900 bg-white'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className={`p-4 sm:p-5 border-t ${
            isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
          }`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Задайте вопрос Альберту о вашей карте и встрече зеркал..."
                className={`flex-1 px-4 py-3 rounded-sm border font-sans text-sm outline-none transition-colors ${
                  isDark
                    ? 'bg-[#0F1412] border-[#2A3B33] text-white placeholder-stone-600 focus:border-[var(--color-antique-gold)]'
                    : 'bg-white border-[#E8DFC8] text-stone-900 placeholder-stone-400 focus:border-[var(--color-antique-gold)]'
                }`}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="px-5 py-3 bg-[var(--color-antique-gold)] text-white hover:bg-[#B8934C] disabled:opacity-30 rounded-sm transition-colors flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
