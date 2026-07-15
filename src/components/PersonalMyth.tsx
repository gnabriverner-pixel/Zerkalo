import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BookOpen, Feather, Loader2, RefreshCw } from 'lucide-react';
import { ApiResponse, StoryInputs } from '../types';

const DRAFT_KEY = 'zerkalo.personal-myth.v1.draft';
const EMPTY_INPUTS: StoryInputs = { q1: '', q2: '', q3: '', q4: '' };

const QUESTIONS = [
  {
    id: 'q1' as const,
    eyebrow: 'Что просит внимания',
    title: 'Что сейчас труднее всего оставить без внимания?',
    placeholder: 'Можно ответить одной фразой или описать состояние своими словами.',
    choices: ['Неясность', 'Перегрузка', 'Ожидание', 'Развилка', 'Одиночество', 'Незавершённость'],
  },
  {
    id: 'q2' as const,
    eyebrow: 'Образ состояния',
    title: 'На какой образ похоже это состояние?',
    placeholder: 'Например: закрытая дверь, туманная дорога, дом с одним освещённым окном.',
    choices: ['Закрытая дверь', 'Туман', 'Пустая комната', 'Тяжёлый рюкзак', 'Мост', 'Ночной сад'],
  },
  {
    id: 'q3' as const,
    eyebrow: 'Точка живости',
    title: 'Где вы в последнее время чувствовали себя живее и яснее?',
    placeholder: 'Место, разговор, работа, движение, музыка или короткий момент.',
    choices: ['В движении', 'В разговоре', 'В работе руками', 'В одиночестве', 'На природе', 'Создавая новое'],
  },
  {
    id: 'q4' as const,
    eyebrow: 'Недостающее качество',
    title: 'Какого качества вам сейчас особенно не хватает?',
    placeholder: 'Назовите одно качество или опишите, как оно ощущается.',
    choices: ['Тишины', 'Смелости', 'Тепла', 'Границы', 'Движения', 'Опоры'],
  },
];

function requestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `myth_${crypto.randomUUID().replaceAll('-', '')}`;
  }
  return `myth_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export default function PersonalMyth() {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<StoryInputs>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...EMPTY_INPUTS, ...JSON.parse(saved) } : EMPTY_INPUTS;
    } catch {
      return EMPTY_INPUTS;
    }
  });
  const [result, setResult] = useState<ApiResponse['story_result'] | null>(null);
  const [errorText, setErrorText] = useState('');
  const [availability, setAvailability] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [activeRequestId, setActiveRequestId] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const question = QUESTIONS[Math.max(0, step - 1)];

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    let active = true;
    fetch('/health/ready')
      .then(async (response) => {
        const data = await response.json();
        const ready = response.ok && data?.features?.personal_myth?.enabled && data?.features?.personal_myth?.ready;
        if (active) setAvailability(ready ? 'ready' : 'unavailable');
      })
      .catch(() => active && setAvailability('unavailable'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (step === 6) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, [step]);

  const canContinue = useMemo(() => {
    if (step < 1 || step > 4) return true;
    return inputs[QUESTIONS[step - 1].id].trim().length >= 3;
  }, [inputs, step]);

  const choose = (value: string) => {
    if (!question) return;
    setInputs((current) => ({ ...current, [question.id]: value }));
  };

  const generate = async (reuseRequest = false) => {
    const id = reuseRequest && activeRequestId ? activeRequestId : requestId();
    setActiveRequestId(id);
    setStep(5);
    setErrorText('');
    try {
      const response = await fetch('/api/personal-myth/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: id,
          consent_version: 'personal-myth-v1',
          answers: inputs,
        }),
      });
      const data: ApiResponse = await response.json();
      if (data.status === 'ok' && data.story_result) {
        setResult(data.story_result);
        setAvailability('ready');
        setStep(6);
        return;
      }
      setErrorText(data.ui?.safe_message || 'Историю не удалось собрать достаточно точно. Ответы сохранены.');
      if (data.status === 'unavailable') setAvailability('unavailable');
      setStep(7);
    } catch {
      setAvailability('unavailable');
      setErrorText('Связь прервалась. Ответы сохранены в этом браузере — можно повторить попытку.');
      setStep(7);
    }
  };

  const reset = () => {
    localStorage.removeItem(DRAFT_KEY);
    setInputs(EMPTY_INPUTS);
    setResult(null);
    setActiveRequestId('');
    setErrorText('');
    setStep(0);
  };

  return (
    <main className="min-h-[100svh] bg-[#111512] text-[#ece9e1]">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.section
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -16 }}
            className="relative mx-auto grid min-h-[calc(100svh-72px)] max-w-6xl items-end overflow-hidden px-5 pb-12 pt-28 md:grid-cols-[1.2fr_0.8fr] md:items-center md:px-10"
          >
            <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_76%_28%,rgba(162,137,93,0.18),transparent_30%),linear-gradient(125deg,#111512_30%,#1a211b_100%)]" />
            <div className="relative z-10 max-w-2xl">
              <p className="mb-5 text-xs uppercase tracking-[0.22em] text-[#b5a27a]">Зеркало себя</p>
              <h1 className="max-w-xl font-serif text-5xl leading-[0.98] text-[#f4f0e7] md:text-7xl">Личный миф</h1>
              <p className="mt-7 max-w-lg font-serif text-xl leading-relaxed text-[#d8d4cb] md:text-2xl">
                История, в которой ваше нынешнее состояние становится образом, движением и одним возможным шагом.
              </p>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#9fa69f]">
                Вы ответите на четыре коротких вопроса. История не объясняет вас окончательно — она даёт другой угол зрения, который можно принять или оставить.
              </p>
              <button
                onClick={() => setStep(1)}
                disabled={availability === 'unavailable'}
                className="mt-9 border border-[#b5a27a] bg-[#b5a27a] px-7 py-4 text-sm font-medium text-[#111512] transition hover:bg-[#c7b58d] disabled:cursor-not-allowed disabled:border-[#414840] disabled:bg-transparent disabled:text-[#717a72]"
              >
                {availability === 'checking' ? 'Проверяем готовность…' : availability === 'ready' ? 'Начать историю' : 'Сейчас недоступно'}
              </button>
              {availability === 'unavailable' && (
                <p className="mt-4 max-w-md text-sm leading-6 text-[#a7aea8]">Сервис истории сейчас не готов. Мы не будем подменять её шаблонным текстом.</p>
              )}
            </div>
            <div aria-hidden="true" className="relative z-10 mt-16 hidden h-[26rem] md:block">
              <div className="absolute left-1/2 top-10 h-72 w-px bg-gradient-to-b from-transparent via-[#b5a27a]/70 to-transparent" />
              <div className="absolute left-[28%] top-[28%] h-40 w-40 rounded-full border border-[#b5a27a]/35" />
              <div className="absolute left-[42%] top-[42%] h-52 w-36 border-l border-t border-[#687168]/40" />
            </div>
          </motion.section>
        )}

        {step >= 1 && step <= 4 && question && (
          <motion.section
            key={question.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="mx-auto flex min-h-[calc(100svh-72px)] w-full max-w-3xl flex-col justify-center px-5 py-28 md:px-10"
          >
            <div className="mb-12 flex items-center justify-between">
              <button onClick={() => setStep(step - 1)} aria-label="Назад" className="p-2 text-[#899189] transition hover:text-white"><ArrowLeft /></button>
              <span className="text-xs uppercase tracking-[0.22em] text-[#7e877f]">{step} / 4</span>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#b5a27a]">{question.eyebrow}</p>
            <h2 className="mt-5 max-w-2xl font-serif text-3xl leading-tight text-[#f1ede5] md:text-5xl">{question.title}</h2>
            <div className="mt-8 flex flex-wrap gap-2">
              {question.choices.map((choice) => (
                <button
                  key={choice}
                  onClick={() => choose(choice)}
                  className={`border px-4 py-3 text-sm transition ${inputs[question.id] === choice ? 'border-[#b5a27a] bg-[#b5a27a] text-[#111512]' : 'border-[#3c443d] text-[#bdc4bd] hover:border-[#7c867d]'}`}
                >{choice}</button>
              ))}
            </div>
            <textarea
              value={inputs[question.id]}
              onChange={(event) => choose(event.target.value)}
              placeholder={question.placeholder}
              className="mt-8 min-h-32 w-full resize-none border-0 border-b border-[#465047] bg-transparent py-4 font-serif text-xl leading-relaxed text-[#ede9df] outline-none placeholder:text-[#606961] focus:border-[#b5a27a]"
            />
            <button
              onClick={() => step < 4 ? setStep(step + 1) : void generate()}
              disabled={!canContinue}
              className="mt-9 self-end border border-[#b5a27a] px-7 py-3 text-sm text-[#ddd2ba] transition hover:bg-[#b5a27a] hover:text-[#111512] disabled:cursor-not-allowed disabled:opacity-30"
            >{step === 4 ? 'Собрать историю' : 'Продолжить'}</button>
          </motion.section>
        )}

        {step === 5 && (
          <motion.section key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[calc(100svh-72px)] flex-col items-center justify-center px-6 text-center">
            <Loader2 className="mb-7 h-7 w-7 animate-spin text-[#b5a27a]" />
            <h2 className="font-serif text-3xl text-[#eee9df]">История собирается</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#8e978f]">Мы связываем ваши четыре ответа в один сюжет. Если связь прервётся, ответы останутся в браузере.</p>
          </motion.section>
        )}

        {step === 7 && (
          <motion.section key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[calc(100svh-72px)] max-w-xl flex-col justify-center px-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[#b5a27a]">История не выдана</p>
            <h2 className="mt-5 font-serif text-4xl text-[#f0ece3]">Лучше остановиться, чем выдать случайный текст.</h2>
            <p className="mt-6 leading-7 text-[#aeb5ae]">{errorText}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button onClick={() => void generate(false)} disabled={availability === 'unavailable'} className="flex items-center gap-2 border border-[#b5a27a] px-5 py-3 text-sm text-[#ddd2ba] disabled:opacity-40"><RefreshCw size={16} /> Повторить</button>
              <button onClick={() => setStep(4)} className="border border-[#414941] px-5 py-3 text-sm text-[#aeb5ae]">Проверить ответы</button>
            </div>
          </motion.section>
        )}

        {step === 6 && result && (
          <motion.article ref={resultRef} key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl px-5 pb-24 pt-28 md:px-10">
            <p className="text-xs uppercase tracking-[0.22em] text-[#b5a27a]">Личный миф</p>
            <h1 className="mt-5 font-serif text-5xl leading-tight text-[#f4f0e7] md:text-6xl">{result.title}</h1>
            <div className="mt-12 space-y-7 font-serif text-xl leading-[1.9] text-[#d8d5cc]">
              {result.story.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>

            <section className="mt-20 border-y border-[#333b34] py-12">
              <div className="flex items-center gap-3 text-[#b5a27a]"><BookOpen size={17} /><h2 className="font-sans text-xs uppercase tracking-[0.22em] text-inherit">Из каких образов родилась история</h2></div>
              <div className="mt-8 space-y-7">
                {result.answer_echoes?.map((echo) => (
                  <div key={echo.answer_key} className="grid gap-2 md:grid-cols-[0.8fr_1.2fr]">
                    <p className="font-serif text-lg text-[#ede7dc]">«{echo.source_phrase}»</p>
                    <p className="text-sm leading-6 text-[#9da59e]">{echo.story_image}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-16">
              <div className="flex items-center gap-3 text-[#b5a27a]"><Feather size={17} /><h2 className="font-sans text-xs uppercase tracking-[0.22em] text-inherit">Один шаг сегодня</h2></div>
              <p className="mt-6 font-serif text-2xl leading-relaxed text-[#ece6dc]">{result.one_step}</p>
              <p className="mt-10 text-xs uppercase tracking-[0.18em] text-[#747d75]">Вопрос для дневника</p>
              <p className="mt-4 font-serif text-xl text-[#c8cdc7]">{result.journal_question}</p>
            </section>

            <p className="mt-16 border-t border-[#293029] pt-8 text-xs leading-6 text-[#737c74]">{result.disclaimer}</p>
            <button onClick={reset} className="mt-10 border border-[#414941] px-5 py-3 text-sm text-[#abb3ac]">Новая история</button>
          </motion.article>
        )}
      </AnimatePresence>
    </main>
  );
}
