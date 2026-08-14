import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalculationResult } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { 
  X, 
  Send, 
  Sparkles, 
  MessageSquare, 
  Loader2, 
  User, 
  Compass, 
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface AlbertDialogueProps {
  isOpen: boolean;
  onClose: () => void;
  calc?: CalculationResult | null;
  initialTopic?: string;
  theme?: 'light' | 'dark';
}

interface Message {
  id: string;
  sender: 'user' | 'albert';
  text: string;
  timestamp: Date;
}

const PRESET_QUESTIONS = [
  'Почему я всё время оказываюсь между двумя противоположными состояниями?',
  'Как моя формула может проявляться в отношениях и близости?',
  'Что мой цифровой код говорит о направлении реализации?',
  'Какая часть моей природы сейчас может быть подавлена?',
  'В чем скрытый ресурс моего составного числа?'
];

export const AlbertDialogue: React.FC<AlbertDialogueProps> = ({
  isOpen,
  onClose,
  calc,
  initialTopic = '',
  theme = 'light'
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const soul = calc?.soul || 1;
  const path = calc?.path || 1;
  const dir = calc?.direction || 1;
  const expr = calc?.expression || 1;
  const res = calc?.result || 1;
  const pathComposite = calc?.pathComposite;

  const soulInfo = numberKnowledge[soul];
  const pathInfo = numberKnowledge[path];

  // Initialize Albert greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = calc
        ? `Здравствуйте. Я вижу вашу формулу: Душа ${soul} (${soulInfo?.planet.split(' ')[0] || ''}), Путь ${path} (${pathInfo?.planet.split(' ')[0] || ''}), Направление ${dir} и Выражение ${expr}.\n\nКарта уже перед нами. О чем из увиденного вы хотели бы поговорить глубже? Вы можете выбрать вопрос или спросить о своей ситуации своими словами.`
        : `Здравствуйте. Я готов обсудить с вами увиденное в зеркале и ответить на ваши вопросы о карте, формуле или образах мифа.\n\nО чем бы вы хотели поговорить?`;
      setMessages([
        {
          id: '1',
          sender: 'albert',
          text: greeting,
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, soul, path, dir, expr, soulInfo, pathInfo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (questionText?: string) => {
    const text = questionText || inputValue;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Local generative response synthesizing the formula and question in Albert's authentic voice
      setTimeout(() => {
        let answer = '';
        const qLower = text.toLowerCase();

        if (qLower.includes('противоположн') || qLower.includes('двумя') || qLower.includes('состояни')) {
          answer = `Это один из ключевых узлов вашей формулы. Ваша Душа (${soul} — ${soulInfo?.planet}) ищет ${soulInfo?.gift.toLowerCase()}, в то время как Число Пути (${path} — ${pathInfo?.planet}) требует ${pathInfo?.task.toLowerCase()}.\n\nКогда эти полярности не осознаются, возникает качели: либо уход в абсолютную автономность, либо попытка жестко зафиксировать контроль. Решение кроется не в подавлении одной из сторон, а в том, чтобы дать Душе чувство вдохновения, а Пути — четкую структуру действий.`;
        } else if (qLower.includes('отношен') || qLower.includes('близост')) {
          answer = `В отношениях Число Души (${soul}) определяет ваш язык чувств и способ принятия другого человека. Для вас критически важно, чтобы партнер признавал вашу внутреннюю ${soulInfo?.keywords.slice(0, 2).join(' и ')}.\n\nОднако при напряжении может проявляться теневая сторона (${soulInfo?.shadow}), когда возникает страх потерять себя. Помните: ваша зрелость в союзе раскрывается через Число Выражения (${expr}), когда диалог строится без ультиматумов, на языке взаимного уважения.`;
        } else if (qLower.includes('реализац') || qLower.includes('направлен') || qLower.includes('дело')) {
          answer = `Ваш вектор реализации опирается на Число Направления ${dir} и формулу ${pathComposite}.\n\nДля вас губительна механическая рутина, где нет пространства для ${soulInfo?.gift.toLowerCase()}. Ваша естественная среда — это проекты, требующие соединения качества формы и стратегического масштаба. Не соглашайтесь на половинчатые компромиссы: формула требует авторского присутствия в том, что вы создаете.`;
        } else if (qLower.includes('подавлен') || qLower.includes('свобод') || qLower.includes('тень')) {
          answer = `Чаще всего у формул с Числом Души ${soul} вытесняется право на ошибку и естественную уязвимость. Под давлением внешних обстоятельств вы можете включать режим повышенной защиты (${pathInfo?.shadow}).\n\nСпросите себя прямо сейчас: «Где я действую из чувства долга, а не из природного импульса?» Ответ на этот вопрос покажет, куда утекает энергия.`;
        } else {
          answer = `Ваш вопрос затрагивает самую сердцевину кода. Сочетание ${soul} и ${path} говорит о том, что вам важно не просто находить ответы умом, а проживать их через телесный и смысловой отклик.\n\nОбратите внимание на Число Итога (${res}): оно напоминает, что любая сложность в текущем периоде — это приглашение к переходу на новый уровень зрелости. Какая мысль первой пришла вам в голову, когда вы прочитали это?`;
        }

        const albertMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'albert',
          text: answer,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, albertMsg]);
        setIsLoading(false);
      }, 700);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
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
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Formula Context Strip */}
          <div className={`px-6 py-2 border-b flex items-center justify-between text-xs font-sans tracking-widest uppercase opacity-80 ${
            isDark ? 'border-[#2A3B33] bg-[#111A16] text-[#A3B8AD]' : 'border-[#EAE3D2] bg-white text-[var(--color-muted)]'
          }`}>
            <span>Душа: {soul} ({soulInfo?.planet.split(' ')[0]})</span>
            <span>Путь: {calc.pathComposite || calc.path}</span>
            <span>Направление: {dir}</span>
            <span>Итог: {res}</span>
          </div>

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
                <span>Альберт сверяется с узлами формулы...</span>
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
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all text-left ${
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
                placeholder="Задайте вопрос Альберту о вашей карте..."
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
