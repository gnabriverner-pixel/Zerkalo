import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalculationResult, MeetingOfMirrorsResult, CodeV2Payload, CodeV2AlbertContext } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { loadTruthState, saveTruthState, truthJourneyKey, hasTruthCorrections, TRUTH_CLEARED_EVENT } from '../services/albertTruthState';
import { useProtectedFetch } from './ConsentBoundary';
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
  journeyId?: string;
  userQuestion?: string;
  onUserQuestionChange?: (question: string) => void;
  userNote?: string;
  onUserNoteChange?: (note: string) => void;
  onClose: () => void;
  calc?: CalculationResult | null;
  storyResult?: any;
  meetingResult?: MeetingOfMirrorsResult | null;
  initialTopic?: string;
  theme?: 'light' | 'dark';
  codeV2Payload?: CodeV2Payload | null;
  codeV2Context?: CodeV2AlbertContext | null;
  codeReactions?: Record<string, 'confirmed' | 'rejected'>;
}

interface Message {
  id: string;
  sender: 'user' | 'albert';
  text: string;
  timestamp: Date;
}

const PRESET_QUESTIONS = [
  'Объясни проще, о чём мой Код',
  'Проверить на моей ситуации',
  'Вот с чем я не согласен',
  'Помоги сделать следующий шаг'
];

export const AlbertDialogue: React.FC<AlbertDialogueProps> = ({
  isOpen,
  journeyId,
  userQuestion = '',
  userNote = '',
  onUserNoteChange,
  onClose,
  calc,
  storyResult,
  meetingResult,
  initialTopic = '',
  theme = 'light',
  codeV2Payload,
  codeV2Context,
  codeReactions = {}
}) => {
  const protectedFetch = useProtectedFetch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const effectiveCalc = calc || (codeV2Payload?.calculation?.five_numbers as any) || null;
  const journeyKey = journeyId || truthJourneyKey(effectiveCalc, storyResult, meetingResult);
  const truthRef = useRef<{ journey: string; state: any }>({ journey: journeyKey, state: loadTruthState(journeyKey) });
  const truthEpochRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  if (truthRef.current.journey !== journeyKey) truthRef.current = { journey: journeyKey, state: loadTruthState(journeyKey) };
  useEffect(() => {
    if (isOpen) {
      truthRef.current = { journey: journeyKey, state: loadTruthState(journeyKey) };
    }
  }, [isOpen, journeyKey]);
  useEffect(() => {
    const clear = () => { truthRef.current.state = undefined; truthEpochRef.current += 1; };
    window.addEventListener(TRUTH_CLEARED_EVENT, clear);
    return () => window.removeEventListener(TRUTH_CLEARED_EVENT, clear);
  }, []);

  useEffect(() => {
    if (isOpen && initialTopic) {
      setInputValue(initialTopic);
    }
  }, [isOpen, initialTopic]);

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
      if (hasTruthCorrections(truthRef.current.state)) {
        greeting = 'Здравствуйте. Продолжим с учётом ваших уточнений. Что сейчас важно рассмотреть?';
      } else if (meetingResult) {
        greeting = `Здравствуйте. Встреча оставила вопрос: «${meetingResult.reflectiveQuestion}». Можем начать с него или с вашей ситуации.`;
      } else if (codeV2Context) {
        const questionPart = codeV2Context.opening_question
          ? `\n\n${codeV2Context.opening_question}`
          : '';
        greeting = `Здравствуйте. ${codeV2Context.opening_statement}${questionPart}\n\nМожем проверить эту развилку на вашей реальной ситуации или разобрать то, с чем вы не согласны.`;
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

  const handleSend = async (questionText?: string, retry = false) => {
    const text = (questionText || inputValue).trim();
    if (!text || isLoading) return;

    const isRetry = retry || Boolean(lastFailedMessage && messages.length > 0 && messages[messages.length - 1].sender === 'user');

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date()
    };

    if (isRetry) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = userMsg;
        return copy;
      });
    } else {
      setMessages(prev => [...prev, userMsg]);
    }
    setInputValue('');
    setIsLoading(true);
    setErrorText(null);
    setLastFailedMessage(null);

    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const truthEpoch = truthEpochRef.current;
      const historyPayload = (isRetry ? messages.slice(0, -1) : messages).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const trimmedUserQuestion = (userQuestion || '').trim().slice(0, 500);
      const contextPayload: Record<string, unknown> = {
        userNote,
        ...(trimmedUserQuestion ? { userQuestion: trimmedUserQuestion } : {}),
        ...(codeReactions && Object.keys(codeReactions).length > 0 ? { codeReactions } : {})
      };
      if (meetingResult) {
        contextPayload.meetingSummary = meetingResult.summary;
        contextPayload.confidenceNote = meetingResult.confidenceNote;
        contextPayload.centralQuestion = meetingResult.reflectiveQuestion;
        contextPayload.albertInsight = meetingResult.albertInsight;
        contextPayload.resonances = meetingResult.parallels;
        contextPayload.divergences = meetingResult.divergences;
      }
      if (effectiveCalc) {
        contextPayload.codeAnchors = {
          numbers: {
            soul: effectiveCalc.soul,
            path: effectiveCalc.path,
            direction: effectiveCalc.direction,
            expression: effectiveCalc.expression,
            result: effectiveCalc.result
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
        contextPayload.codeV2Payload = {
          central_motif: codeV2Payload.central_motif || codeV2Payload.synthesis.strongest_motif,
          albert_context: codeV2Payload.albert_context,
          calculation: codeV2Payload.calculation
            ? { canonical_result: codeV2Payload.calculation.canonical_result }
            : undefined,
          positions: codeV2Payload.positions.map(pos => ({
            position: pos.position,
            public_name: pos.public_name,
            role: pos.role,
            energy: pos.energy,
            essence: pos.essence
          }))
        };
      }

      const res = await protectedFetch('/api/albert/dialogue', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          context: contextPayload,
          truthState: truthRef.current.state
        })
      });

      if (controller.signal.aborted) return;
      if (!res) {
        if (!isRetry) setMessages(prev => prev.filter(message => message.id !== userMsg.id));
        setInputValue(text);
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const safeMessage = errJson?.ui?.safe_message || 'Собеседник временно недоступен. Результаты остаются на странице — попробуйте повторить запрос.';
        setErrorText(safeMessage);
        setLastFailedMessage(text);
        setInputValue(prev => prev || text);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      if (controller.signal.aborted) return;
      if (data.truthState && truthEpoch === truthEpochRef.current) {
        truthRef.current.state = data.truthState;
        saveTruthState(journeyKey, data.truthState);
      }
      if (data.status !== 'ok' || !data.message) {
        const safeMessage = data?.ui?.safe_message || 'Не удалось получить ответ. Попробуйте повторить запрос.';
        setErrorText(safeMessage);
        setLastFailedMessage(text);
        setInputValue(prev => prev || text);
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
      if (controller.signal.aborted) return;
      console.error("Albert dialogue request failed:", err);
      setErrorText("Собеседник временно недоступен. Результаты остаются на странице — попробуйте повторить запрос.");
      setLastFailedMessage(text);
      setInputValue(prev => prev || text);
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage, true);
    }
  };

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden">
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
          className={`relative w-full max-w-3xl h-[100dvh] sm:h-[85vh] max-h-[100dvh] flex flex-col sm:rounded-sm shadow-2xl z-10 overflow-hidden border ${
            isDark 
              ? 'bg-[#0F1412] text-[#EAEAEA] border-[#2A3B33]' 
              : 'bg-[#FCFAF6] text-[#1A1A1A] border-[#E8DFC8]'
          }`}
        >
          {/* Header (Service Labels Visually Separated) */}
          <div className={`px-4 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between border-b shrink-0 ${
            isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full border border-[var(--color-antique-gold)] flex items-center justify-center bg-[var(--color-antique-gold)]/10 text-[var(--color-antique-gold)] shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] tracking-[0.2em] uppercase font-sans text-[var(--color-antique-gold)]/85 truncate">
                  Собеседник по карте
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-normal truncate">
                  Альберт Вяземский
                </h3>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Закрыть диалог"
              className={`min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${
                isDark 
                  ? 'text-stone-400 hover:text-white hover:bg-[#1A2621]' 
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Formula Context Strip (Separated Service Metadata) */}
          {effectiveCalc && (
            <div className={`px-4 sm:px-6 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tracking-wider uppercase shrink-0 ${
              isDark ? 'border-[#2A3B33] bg-[#111A16] text-[#A3B8AD]' : 'border-[#EAE3D2] bg-white text-[var(--color-muted)]'
            }`}>
              <span>Душа: {soul}</span>
              <span>Путь: {effectiveCalc.pathComposite || path}</span>
              <span>Направление: {dir}</span>
              <span>Итог: {res}</span>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:p-6 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 px-1 text-xs font-mono uppercase tracking-wider opacity-70">
                  {msg.sender === 'albert' ? (
                    <span className="text-[var(--color-antique-gold)]">Альберт Вяземский</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>Вы</span>
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: msg.sender === 'albert' ? '18px' : '16px',
                    lineHeight: msg.sender === 'albert' ? 1.6 : 1.5,
                  }}
                  className={`w-full max-w-full sm:max-w-[88%] p-4 sm:p-5 rounded-xl whitespace-pre-line break-words shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-[var(--color-antique-gold)] text-white font-sans text-[16px] leading-[1.5]'
                      : isDark
                        ? 'bg-[#141C18] border border-[#2A3B33] text-[#EAEAEA] font-serif text-[18px] leading-[1.6]'
                        : 'bg-white border border-[#E8DFC8] text-[#1A1A1A] font-serif text-[18px] leading-[1.6]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs tracking-wider uppercase font-sans text-[var(--color-antique-gold)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Альберт формулирует ответ...</span>
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

            {onUserNoteChange && messages.some(m => m.sender === 'user') && (
              <label className="block space-y-2 text-sm text-stone-300 font-sans">
                <span>Что я хочу оставить себе</span>
                <textarea aria-label="Моя мысль после разговора" value={userNote} maxLength={2000}
                  onChange={e => onUserNoteChange(e.target.value)} rows={2}
                  placeholder="Своими словами: что стало яснее или с чем я не согласен"
                  className="w-full rounded border border-white/20 bg-black/20 p-3 text-[16px] text-inherit" />
                <span className="block text-xs">Эта заметка останется в текущем исследовании. Сохранение на устройстве — в «Моём зеркале».</span>
              </label>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Prompts */}
          <div className={`px-4 sm:px-6 py-2.5 border-t overflow-x-auto flex gap-2 no-scrollbar shrink-0 ${
            isDark ? 'border-[#2A3B33] bg-[#111A16]' : 'border-[#EAE3D2] bg-[#FAF8F5]'
          }`}>
            {PRESET_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() =>
                  setInputValue(
                    q === 'Объясни проще, о чём мой Код'
                      ? 'Я ничего не понял, объясни внятно и простыми словами, о чём мой Код.'
                      : q === 'Вот с чем я не согласен'
                      ? 'Не согласен с тем, что '
                      : q === 'Проверить на моей ситуации'
                      ? 'В моей ситуации '
                      : 'Мне важно сделать следующий шаг в '
                  )
                }
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
          <div className={`p-3.5 sm:p-5 border-t shrink-0 ${
            isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
          }`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2.5 sm:gap-3"
            >
              <input
                type="text"
                style={{ fontSize: '16px' }}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  meetingResult
                    ? 'Задайте вопрос Альберту о вашей карте и встрече зеркал...'
                    : 'Задайте вопрос Альберту о вашей карте...'
                }
                className={`flex-1 min-w-0 px-4 py-3 rounded-xl border font-sans text-[16px] outline-none transition-colors ${
                  isDark
                    ? 'bg-[#0F1412] border-[#2A3B33] text-white placeholder-stone-500 focus:border-[var(--color-antique-gold)]'
                    : 'bg-white border-[#E8DFC8] text-stone-900 placeholder-stone-400 focus:border-[var(--color-antique-gold)]'
                }`}
              />
              <button
                type="submit"
                aria-label="Отправить сообщение"
                disabled={!inputValue.trim() || isLoading}
                className="min-h-[48px] px-4 sm:px-5 py-3 bg-[var(--color-antique-gold)] text-white hover:bg-[#B8934C] disabled:opacity-30 rounded-xl transition-colors flex items-center justify-center shrink-0 cursor-pointer"
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
