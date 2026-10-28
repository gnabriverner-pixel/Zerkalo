import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CodeV2Payload, CodeV2Position, CodeV2Interaction, CodeV2PositionScene } from '../../types';
import { readerStory, albertLead } from './miniStory';
import { EmblemPlate } from '../../art/emblem';
import { Term, renderTextWithTerms } from '../Term';
import { GLOSSARY_ROLES } from '../../data/glossary';
import { hasCanonicalV2Result } from '../../services/codeV2Session';
import { validateBirthDate } from '../../services/birthDate';
import { loadQaPanel, type QaPanelModule } from './qaPanelLoader';
import { useProtectedFetch, useInlineConsent } from '../ConsentBoundary';
import { reportPathEvent } from '../../services/pathEvents';
import { DateConsentField, DATE_CONSENT_REQUIRED_MESSAGE } from '../DateConsentField';
import './codeReading.css';
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Compass,
  MessageSquare,
  Loader2,
  Sparkles,
  Eye,
  AlertCircle
} from 'lucide-react';

export type CodeV2ReactionStatus = 'confirmed' | 'rejected';

const ROLE_READING_HINTS: Record<string, string> = {
  soul: 'Что вам хочется внутренне',
  expression: 'Что заметно в ваших поступках',
  path: 'Как вы учитесь действовать',
  direction: 'В каком окружении вам легче',
  result: 'Что вы создаёте своими действиями'
};

export interface CodeV2AlbertOpenOptions {
  userQuestion?: string;
  initialPrompt?: string;
  reactionItem?: {
    key: string;
    status: CodeV2ReactionStatus;
    claimText: string;
  };
}

interface CodeV2ExperienceProps {
  initialDate?: string;
  initialPayload?: CodeV2Payload;
  initialExpanded?: Record<string, boolean>;
  isQaMode?: boolean;
  userQuestion?: string;
  onChangeUserQuestion?: (question: string) => void;
  onUserQuestionChange?: (question: string) => void;
  initialReactions?: Record<string, CodeV2ReactionStatus>;
  onReactionChange?: (
    key: string,
    status: CodeV2ReactionStatus,
    claimText: string
  ) => void;
  onOpenAlbert: (payload: CodeV2Payload, options?: CodeV2AlbertOpenOptions) => void;
  onCalculated?: (payload: CodeV2Payload) => void;
  autoCalculate?: boolean;
  onAutoCalculateConsumed?: () => void;
  onChangeDate?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  onBackToCollection?: () => void;
  onSwitchToV1?: () => void;
  onOpenMyth?: () => void;
  /** One calm line about the free window (from /api/free-preview), shown at the bridge to the Myth. */
  freeWindowLine?: string | null;
  isExample?: boolean;
}

function getFirstSentence(text: string): string {
  if (!text) return '';
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text;
}

export function cleanPositionEssence(text: string): string {
  if (!text) return '';
  const [intro] = text.split(/\n\s*#{1,6}\s+/u, 1);
  return intro
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/^\s*[*-]\s+/gmu, '')
    .trim();
}

const RUSSIAN_STOP_WORDS = new Set([
  'как', 'мне', 'меня', 'мой', 'моя', 'мое', 'моё', 'мои', 'что', 'это',
  'этот', 'эта', 'эти', 'для', 'или', 'при', 'без', 'над', 'под', 'про',
  'вас', 'вам', 'вами', 'вот', 'где', 'кто', 'чем', 'так', 'уже', 'еще',
  'ещё', 'все', 'всё', 'быть', 'есть', 'если', 'когда', 'между', 'через',
  'один', 'одна', 'одно', 'одни', 'двумя', 'двух', 'очень'
]);

export function formatSceneExample(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Match the first complete sentence ending in . ! or ?
  // Do NOT split on em-dash (—) or semicolons within a sentence.
  const sentenceMatch = trimmed.match(/^([^.!?]+[.!?])/);
  if (sentenceMatch) {
    return sentenceMatch[1].trim();
  }
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

export function selectRelevantSceneExample(
  scenes: CodeV2PositionScene[] | undefined,
  userQuestion?: string
): string {
  if (!scenes || scenes.length === 0) return '';
  const trimmedQ = (userQuestion || '').trim();
  if (!trimmedQ) {
    return formatSceneExample(scenes[0]?.description || '');
  }

  const rawTokens = trimmedQ
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  // Filter stop words while retaining meaningful content keywords
  const tokens = rawTokens.filter(t => !RUSSIAN_STOP_WORDS.has(t));
  const activeTokens = tokens.length > 0 ? tokens : rawTokens;

  if (activeTokens.length === 0) {
    return formatSceneExample(scenes[0]?.description || '');
  }

  // Pre-calculate stems (4-5 chars) for inflected Russian matching
  const stems = activeTokens.map(t => (t.length > 5 ? t.slice(0, 5) : t.length === 5 ? t.slice(0, 4) : t));

  let bestScene = scenes[0];
  let maxScore = 0;

  for (const scene of scenes) {
    const text = `${scene.title} ${scene.description}`.toLowerCase();
    let score = 0;
    for (let i = 0; i < activeTokens.length; i++) {
      const token = activeTokens[i];
      const stem = stems[i];
      if (text.includes(token)) {
        score += 2;
      } else if (stem && text.includes(stem)) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestScene = scene;
    }
  }

  const raw = bestScene?.description || scenes[0]?.description || '';
  return formatSceneExample(raw);
}

// DEV-ONLY QA surfaces (top bar + preset picker) live in ./qaPanel and are loaded
// through loadQaPanel() (compile-time `import.meta.env.DEV` branch), so the
// production build physically excludes them: no QA copy, no preset dates in the bundle.
// The preset dates mirror the canonical acceptance fixtures of the server acceptance
// suite (the documented golden case).

export function CodeV2Experience({
  initialDate = '',
  initialPayload,
  initialExpanded,
  isQaMode = false,
  userQuestion = '',
  onChangeUserQuestion,
  onUserQuestionChange,
  initialReactions = {},
  onReactionChange,
  onOpenAlbert,
  onCalculated,
  autoCalculate,
  onAutoCalculateConsumed,
  onChangeDate,
  onContinue,
  continueLabel = 'Перейти к Личному мифу',
  onBackToCollection,
  onSwitchToV1,
  onOpenMyth,
  freeWindowLine,
  isExample = false
}: CodeV2ExperienceProps) {
  const isQaEffective = Boolean(isQaMode && import.meta.env.DEV);
  const [qaPanel, setQaPanel] = useState<QaPanelModule | null>(null);
  useEffect(() => {
    if (!isQaEffective) {
      setQaPanel(null);
      return;
    }
    let cancelled = false;
    loadQaPanel()
      .then(m => {
        if (!cancelled && m) {
          setQaPanel(m);
          document.title = m.QA_DOCUMENT_TITLE;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isQaEffective]);
  const protectedFetch = useProtectedFetch();
  const inlineConsent = useInlineConsent();
  const [consentChecked, setConsentChecked] = useState(false);
  const [day, setDay] = useState(() => (initialDate ? initialDate.split('.')[0] || '' : ''));
  const [month, setMonth] = useState(() => (initialDate ? initialDate.split('.')[1] || '' : ''));
  const [year, setYear] = useState(() => (initialDate ? initialDate.split('.')[2] || '' : ''));

  const [dateError, setDateError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CodeV2Payload | null>(initialPayload || null);
  const [localQuestion, setLocalQuestion] = useState<string>(userQuestion || '');
  const [reactions, setReactions] = useState<Record<string, CodeV2ReactionStatus>>(initialReactions);

  useEffect(() => {
    setLocalQuestion(userQuestion || '');
  }, [userQuestion]);

  useEffect(() => {
    setReactions(initialReactions || {});
  }, [initialReactions]);

  const handleQuestionInput = (val: string) => {
    const bounded = val.slice(0, 500);
    setLocalQuestion(bounded);
    onChangeUserQuestion?.(bounded);
    onUserQuestionChange?.(bounded);
  };

  const handleMarkReaction = (key: string, status: CodeV2ReactionStatus, claimText: string) => {
    setReactions(prev => ({ ...prev, [key]: status }));
    onReactionChange?.(key, status, claimText);
  };

  // Progressive disclosure states (collapsed by default to achieve 450-700 words budget)
  const [showCalcChain, setShowCalcChain] = useState(false);
  const [showHeroMotifDetails, setShowHeroMotifDetails] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>(initialExpanded || {});

  const soulPos = payload?.positions.find(p => p.position === 'soul');
  const pathPos = payload?.positions.find(p => p.position === 'path');
  const leadInteractionBadge = soulPos && pathPos
    ? `${soulPos.energy_name} (${soulPos.energy}) ⟷ ${pathPos.energy_name} (${pathPos.energy})`
    : null;

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  const fetchV2Calculation = async (fullDob: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoading(true);
    setApiError(null);
    setDateError('');

    try {
      const resp = await protectedFetch('/api/code-v2', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dob: fullDob })
      });
      if (!resp) return;

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.message || 'Не удалось рассчитать карту');
      }

      const data = await resp.json();
      if (data.status !== 'ok' || !data.payload || !hasCanonicalV2Result(data.payload)) {
        throw new Error('Некорректный ответ сервиса расчёта');
      }

      if (controller.signal.aborted) return;
      setPayload(data.payload);
      if (!isExample) reportPathEvent('code_result_shown');
      onCalculated?.(data.payload);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      if (err?.message === 'consent_cancelled') return;
      console.error('Code calculation failed:', err);
      setApiError(err.message || 'Ошибка соединения с модулем расчёта');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  // A linked or restored date only fills the form. Sending it requires a click.
  useEffect(() => {
    if (!initialDate) return;
    if (initialPayload?.calculation.date === initialDate && hasCanonicalV2Result(initialPayload)) {
      setPayload(initialPayload);
      return;
    }
    const parts = initialDate.split('.');
    if (parts.length === 3) {
      const d = parts[0].trim().padStart(2, '0');
      const m = parts[1].trim().padStart(2, '0');
      const y = parts[2].trim();
      setDay(d);
      setMonth(m);
      setYear(y);
    }
  }, [initialDate]);

  // Auto-calculate triggered explicitly (e.g. from "Посмотреть пример" with demo date 14.03.1987)
  useEffect(() => {
    if (!autoCalculate || !initialDate) return;
    const parts = initialDate.split('.');
    if (parts.length === 3) {
      const d = parts[0].trim().padStart(2, '0');
      const m = parts[1].trim().padStart(2, '0');
      const y = parts[2].trim();
      const validation = validateBirthDate(d, m, y);
      if (validation.valid) {
        setDay(d);
        setMonth(m);
        setYear(y);
        fetchV2Calculation(validation.formatted);
        onAutoCalculateConsumed?.();
      }
    }
  }, [autoCalculate, initialDate]);

  const handleCalculate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const d = day.trim().padStart(2, '0');
    const m = month.trim().padStart(2, '0');
    const y = year.trim();

    const validation = validateBirthDate(d, m, y);
    if (!validation.valid) {
      setDateError('message' in validation ? validation.message : 'Проверьте дату рождения');
      return;
    }

    // The date leaves the browser only after the consent mark at the date field (or an earlier valid consent).
    if (!inlineConsent.accepted && !consentChecked) {
      setDateError(DATE_CONSENT_REQUIRED_MESSAGE);
      return;
    }

    setDay(d);
    setMonth(m);
    setYear(y);
    void (async () => {
      if (!inlineConsent.accepted) {
        try {
          await inlineConsent.accept();
        } catch {
          setApiError('Согласие не сохранено. Попробуйте ещё раз.');
          return;
        }
      }
      reportPathEvent('date_entered');
      fetchV2Calculation(validation.formatted);
    })();
  };

  const handleSelectPreset = (presetDob: string) => {
    const [pDay, pMonth, pYear] = presetDob.split('.');
    setDay(pDay);
    setMonth(pMonth);
    setYear(pYear);
    setDateError('');
    fetchV2Calculation(presetDob);
  };

  const toggleDetails = (posName: string) => {
    setExpandedDetails(prev => ({
      ...prev,
      [posName]: !prev[posName]
    }));
  };

  return (
    <div className="w-full min-h-screen bg-[#090D15] text-[#EAEAEA] font-sans pb-32 selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none opacity-40 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(200,164,93,0.12)_0%,transparent_70%)]" />
        <div className="absolute bottom-1/3 left-1/3 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(60,80,120,0.1)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 flex flex-col items-center">
        
        {/* ========================================================= */}
        {/* TOP BAR - QA MODE ONLY */}
        {/* ========================================================= */}
        {qaPanel && <qaPanel.QaTopBar onSwitchToV1={onSwitchToV1} />}

        {/* ========================================================= */}
        {/* ENTRY SCREEN (WHEN NO PAYLOAD) */}
        {/* ========================================================= */}
        {!payload && (
          <div className="w-full max-w-xl flex flex-col items-center pt-4 sm:pt-10">
            <div className="text-center max-w-xl mb-8 sm:mb-10">
              <div className="text-[13px] font-mono tracking-widest uppercase text-[var(--color-antique-gold)]/80 mb-3">
                ЗЕРКАЛО СЕБЯ
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl font-light text-stone-100 tracking-tight mb-4">
                Ваши пять чисел
              </h1>
              <div className="text-sm sm:text-base text-stone-300 font-normal leading-relaxed max-w-lg mx-auto space-y-3">
                <p>
                  Посмотрите на привычную ситуацию с неожиданной стороны.
                </p>
                <p className="text-stone-400 text-xs sm:text-sm">
                  У каждого числа здесь своя роль. Роль подсказывает, куда посмотреть, а число — при каком свете. Узнавать себя во всём не обязательно.
                </p>
              </div>
            </div>

            {/* QA Presets: dev-only module, physically absent from production build */}
            {qaPanel && (
              <qaPanel.QaPresetPicker
                currentDob={day && month && year ? `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}` : ''}
                onSelect={handleSelectPreset}
              />
            )}

            {/* Date input form */}
            <div className="w-full bg-[#0E1422]/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
              <form onSubmit={handleCalculate} className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                <div className="grid grid-cols-3 gap-3 flex-grow">
                  <div>
                    <label className="block text-[13px] font-mono uppercase tracking-wider text-stone-400 mb-1.5 text-center sm:text-left">
                      День
                    </label>
                    <input
                      ref={dayRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={day}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setDay(val);
                        if (val.length === 2) monthRef.current?.focus();
                      }}
                      placeholder="ДД"
                      className="w-full text-center bg-black/40 border border-white/10 focus:border-[var(--color-antique-gold)] rounded-xl py-3 text-lg font-mono text-white outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-mono uppercase tracking-wider text-stone-400 mb-1.5 text-center sm:text-left">
                      Месяц
                    </label>
                    <input
                      ref={monthRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={month}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setMonth(val);
                        if (val.length === 2) yearRef.current?.focus();
                      }}
                      placeholder="ММ"
                      className="w-full text-center bg-black/40 border border-white/10 focus:border-[var(--color-antique-gold)] rounded-xl py-3 text-lg font-mono text-white outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-mono uppercase tracking-wider text-stone-400 mb-1.5 text-center sm:text-left">
                      Год
                    </label>
                    <input
                      ref={yearRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={year}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setYear(val);
                      }}
                      placeholder="ГГГГ"
                      className="w-full text-center bg-black/40 border border-white/10 focus:border-[var(--color-antique-gold)] rounded-xl py-3 text-lg font-mono text-white outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="min-h-[52px] px-8 rounded-xl bg-gradient-to-r from-[var(--color-antique-gold)] to-[#D4B26F] text-[#111622] font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-amber-950/30 disabled:opacity-50 whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Открываем Код...</span>
                    </>
                  ) : (
                    <>
                      <span>Посмотреть свой разбор</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {!inlineConsent.accepted && (
                <DateConsentField checked={consentChecked} onChange={value => { setConsentChecked(value); if (value) setDateError(''); }} />
              )}

              {dateError && (
                <div className="mt-4 text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{dateError}</span>
                </div>
              )}

              {apiError && (
                <div className="mt-4 text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CALCULATED STATE: CURIOSITY & MEANING FIRST */}
        {/* ========================================================= */}
        {payload && (
          <div ref={resultsRef} className="w-full space-y-10 sm:space-y-14">
            
            {isExample && (
              <div className="w-full text-xs text-stone-400 font-serif italic pb-2 border-b border-white/5">
                Пример разбора для вымышленной даты 14.03.1987.
              </div>
            )}

            {/* Minimal date indicator with edit link */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 text-xs text-stone-400">
              <div className="flex items-center gap-2">
                <span className="font-serif text-stone-200 text-sm">
                  {isExample ? 'Пример пяти чисел' : 'Ваши пять чисел'}
                </span>
                <span>·</span>
                <span className="font-mono text-stone-300">{payload.calculation.date}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  requestRef.current?.abort();
                  setPayload(null);
                  setDateError('');
                  setApiError(null);
                  onChangeDate?.();
                  setTimeout(() => dayRef.current?.focus(), 100);
                }}
                className="text-stone-400 hover:text-[var(--color-antique-gold)] transition-colors cursor-pointer text-xs"
              >
                {isExample ? 'Ввести свою дату' : 'Изменить дату'}
              </button>
            </div>

            {/* 1. HERO OPENING: FIVE NUMBERS & CENTRAL MOTIF (MEANING FIRST) */}
            <section className="w-full bg-gradient-to-br from-[#12192B] via-[#0E1524] to-[#0A0E18] border border-[var(--color-antique-gold)]/30 rounded-3xl p-6 sm:p-9 relative shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(circle_at_top_right,rgba(200,164,93,0.12),transparent_70%)] pointer-events-none" />

              {/* Celestial Immersion Intro */}
              <div className="text-center max-w-xl mx-auto mb-8 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-antique-gold)]/25 text-[13px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] mb-3">
                  <Sparkles className="w-3 h-3" />
                  <span>Как читать</span>
                </div>
                <h1 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-2">
                  Пять чисел, пять ролей
                </h1>
                <p className="text-xs sm:text-sm text-stone-300 font-normal leading-relaxed">
                  Каждое число здесь связано с образом светила. Рядом — сторона жизни, о которой пойдёт речь.
                </p>
              </div>

              {/* A. Five Numbers Visually (Editorial Typographic Strip) */}
              <div className="flex flex-col items-center text-center mb-7 relative z-10">
                <div className="text-[13px] sm:text-sm font-mono tracking-widest uppercase text-[var(--color-antique-gold)]/80 mb-3">
                  Ваши пять чисел и их роли
                </div>

                <dl className="code-role-map">
                  {payload.positions.map((pos) => (
                    <div key={pos.position}>
                      <dt>
                        <span className="code-role-number font-serif text-amber-100">
                          {pos.energy}
                        </span>
                        <span className="text-sm text-[var(--color-antique-gold)] mt-1.5">
                          {pos.energy_name}
                        </span>
                        <span className="text-sm text-stone-100 mt-1">
                          {GLOSSARY_ROLES[pos.position]?.title.split(' · ')[0] || pos.public_name.replace('Число ', '')}
                        </span>
                      </dt>
                      <dd className="text-sm text-stone-300">{ROLE_READING_HINTS[pos.position]}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 text-[13px] sm:text-sm text-stone-400 font-normal leading-relaxed max-w-xl text-center">
                  Узнавать себя во всём не обязательно.
                </p>
              </div>

              {/* B & C. Central Human Motif (Heading + Why It Matters) */}
              <div className="pt-6 border-t border-white/10 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-[13px] sm:text-sm font-mono tracking-widest uppercase text-[var(--color-antique-gold)]/80">
                    Главное в вашей дате
                  </div>
                  {leadInteractionBadge && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-antique-gold)]/15 border border-[var(--color-antique-gold)]/35 text-[13px] font-mono text-amber-200">
                      <span>{leadInteractionBadge}</span>
                    </div>
                  )}
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-4 leading-snug">
                  {payload.albert_context?.strongest_hypothesis || 'Внутренний контраст вашей карты'}
                </h2>

                {(() => {
                  const rawMotif = typeof payload.central_motif === 'string'
                    ? payload.central_motif
                    : (payload.central_motif as any)?.text || payload.synthesis?.strongest_motif || '';
                  const motifParagraphs = rawMotif
                    .split('\n\n')
                    .map((p: string) => p.trim())
                    .filter(Boolean);
                  return (
                    <div className="pl-4 border-l-2 border-[var(--color-antique-gold)]/60 text-base sm:text-[17px] text-stone-200 leading-relaxed font-normal mb-6 space-y-3">
                      <p className="text-stone-400 text-sm">Сравните это описание со своей жизнью. Оно может не совпасть.</p>
                      {motifParagraphs.map((paragraph: string, pIdx: number) => (
                        <p key={pIdx}>{paragraph}</p>
                      ))}
                    </div>
                  );
                })()}

                {/* Quiet Albert Invitation & Central Hypothesis Reaction */}
                {!isExample && (
                  <div className="pt-5 border-t border-white/10 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-stone-200 font-medium">
                        Хотите проверить это на себе?
                      </div>
                      <div className="text-xs text-stone-400 font-normal mt-0.5">
                        {reactions['central_motif'] === 'rejected'
                          ? 'Отмечено «Не похоже» — ваша поправка важнее исходной гипотезы.'
                          : reactions['central_motif'] === 'confirmed'
                          ? 'Отмечено «Похоже» — Альберт учтёт ваш отклик.'
                          : 'Альберт уже видит вашу карту.'}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleMarkReaction(
                            'central_motif',
                            'confirmed',
                            payload.albert_context?.strongest_hypothesis || payload.central_motif || ''
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                          reactions['central_motif'] === 'confirmed'
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                            : 'bg-white/5 border-white/10 text-stone-300 hover:border-white/25'
                        }`}
                      >
                        Похоже
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleMarkReaction(
                            'central_motif',
                            'rejected',
                            payload.albert_context?.strongest_hypothesis || payload.central_motif || ''
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                          reactions['central_motif'] === 'rejected'
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                            : 'bg-white/5 border-white/10 text-stone-300 hover:border-white/25'
                        }`}
                      >
                        Не похоже
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAlbert(payload, {
                            userQuestion: localQuestion.trim() || undefined,
                            initialPrompt: localQuestion.trim()
                              ? `Мой вопрос: ${localQuestion.trim()}`
                              : undefined
                          })
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-[var(--color-antique-gold)]/15 border border-[var(--color-antique-gold)]/40 hover:bg-[var(--color-antique-gold)]/25 text-amber-200 text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Уточнить</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>

              {/* D. Expandable Calculation: "Вот откуда это взялось" (Meaning first, calculation second) */}
              <div className="mt-6 pt-4 border-t border-white/10 relative z-10">
                <button
                  type="button"
                  onClick={() => setShowCalcChain(!showCalcChain)}
                  className="text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5 text-[var(--color-antique-gold)]" />
                  <span>{showCalcChain ? 'Скрыть ход расчёта' : 'Вот откуда это взялось'}</span>
                  {showCalcChain ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400" />}
                </button>

                <AnimatePresence>
                  {showCalcChain && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="mt-4 pt-4 border-t border-white/5 overflow-hidden"
                    >
                      <div className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-3">
                        Откуда взялись эти числа:
                      </div>
                      <div className="space-y-2">
                        {payload.calculation.calculation_chain.map((step, idx) => (
                          <div
                            key={step.position}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-black/40 rounded-xl border border-white/5 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-white/10 text-stone-300 font-mono text-[13px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="font-medium text-stone-200">{step.public_name}:</span>
                              <span className="text-stone-400">{step.formula_label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <code className="font-mono text-amber-200 bg-black/60 px-2.5 py-1 rounded-md border border-white/5">
                                {step.calculation}
                              </code>
                              <span className="text-[13px] text-stone-400 hidden sm:inline">
                                {step.rule}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* 4. FIVE POSITIONS - EDITORIAL CHAPTERS */}
            <section className="w-full space-y-6">
              <div className="text-center max-w-xl mx-auto mb-2">
                <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                  Пять комнат вашего дома
                </h2>
              </div>

              <div className="space-y-6">
                {payload.positions.map((pos) => {
                  const isExpanded = !!expandedDetails[pos.position];
                  const story = readerStory(pos.mini_story, pos.verification_question);
                  const publicEssence = cleanPositionEssence(pos.essence);
                  const firstSceneExample = selectRelevantSceneExample(
                    pos.life_scenes,
                    localQuestion.trim() || userQuestion?.trim()
                  );
                  const posReaction = reactions[pos.position];
                  return (
                    <div
                      key={pos.position}
                      className="code-room w-full bg-[#0D1322]/80 border border-white/5 rounded-2xl p-6 sm:p-8"
                    >
                      {/* Position Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-5 border-b border-white/5">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 pt-0.5">
                            <EmblemPlate planet={pos.energy} variant="obsidian" size={72} />
                          </div>
                          <div>
                            <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-antique-gold)] mb-1">
                              <Term role={pos.position}>
                                {GLOSSARY_ROLES[pos.position]?.title || `${pos.public_name} · ${pos.role}`}
                              </Term>
                            </div>
                            <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                              <Term planet={pos.energy}>{pos.energy_name}</Term> · {pos.energy}
                            </h3>
                            <p className="mt-2 text-base text-stone-300">{ROLE_READING_HINTS[pos.position]}</p>
                          </div>
                        </div>
                      </div>

                      {story && albertLead(pos.position, pos.energy) && (
                        <p className="code-room-lead border-l-2 border-[var(--color-antique-gold)]/50 pl-3 text-base text-stone-300">
                          <span className="block text-xs uppercase tracking-wider text-[var(--color-antique-gold)]/90">Альберт — ИИ-собеседник</span>
                          {albertLead(pos.position, pos.energy)}
                        </p>
                      )}
                      {story && (
                        (() => {
                          const seenTermsInStory = new Set<string>();
                          return (
                            <div className="code-room-story">
                              {story.title && (
                                <h4 className="font-serif text-2xl sm:text-[32px] text-stone-100 font-light mb-3 leading-snug">
                                  {story.title}
                                </h4>
                              )}
                              {story.paragraphs.map((para, i) => (
                                <p key={i} className="text-stone-200">
                                  {renderTextWithTerms(para, seenTermsInStory)}
                                </p>
                              ))}
                            </div>
                          );
                        })()
                      )}
                      {/* 1. О чём это число (человеческий смысл) */}
                      {!story && (<>
                      <div className="mb-4">
                        <div className="text-xs font-medium text-stone-400 mb-2">
                          О чём это число ({pos.public_name}, {pos.energy})
                        </div>
                        {pos.position === 'path' && (
                          <p className="mb-3 rounded-xl border border-[var(--color-antique-gold)]/20 bg-[var(--color-antique-gold)]/5 px-4 py-3 text-base text-stone-300 font-normal leading-relaxed">
                            Это не готовая черта характера, а направление практики.
                          </p>
                        )}
                        <p className="text-base sm:text-[17px] text-stone-200 font-normal leading-relaxed">
                          {isExpanded ? publicEssence : getFirstSentence(publicEssence)}
                        </p>
                      </div>

                      </>)}
                      {/* 2. Конкретный пример проявления */}
                      {!story && firstSceneExample && (
                        <div className="mb-4 pl-3.5 border-l border-[var(--color-antique-gold)]/40 text-sm sm:text-base text-stone-300 leading-relaxed">
                          <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-antique-gold)]/90 block mb-0.5">
                            Пример
                          </span>
                          <span>{firstSceneExample}</span>
                        </div>
                      )}

                      <div className="code-room-question flex items-start gap-3">
                        <Compass className="w-4 h-4 text-[var(--color-antique-gold)] flex-shrink-0 mt-1" />
                        <div className="min-w-0">
                          <span className="text-sm text-stone-300 block mb-2">Проверьте на себе:</span>
                          <p className="text-stone-100 font-serif italic">«{story ? story.question : pos.verification_question}»</p>
                        </div>
                      </div>

                      {/* Progressive disclosure: Dynamic Forces & Life Scenes */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            id={`code-details-${pos.position}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-3 mb-6 pt-3 border-t border-white/5 overflow-hidden"
                          >
                            {pos.position === 'direction' && pos.direction_compound ? (
                              <div className="space-y-4">
                                <div className="rounded-xl border border-[var(--color-antique-gold)]/20 bg-[var(--color-antique-gold)]/5 p-4 sm:p-5">
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span className="text-[13px] font-mono uppercase tracking-wider text-[var(--color-antique-gold)]">
                                      {pos.direction_compound.origin.label}
                                    </span>
                                    <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 font-mono text-[13px] text-stone-200">
                                      {pos.direction_compound.origin.formula}
                                    </span>
                                  </div>
                                  <p className="text-base text-stone-200 font-normal leading-relaxed">
                                    {pos.direction_compound.origin.summary}
                                  </p>
                                </div>

                                {pos.direction_compound.compound && (
                                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                      <span className="text-[13px] font-mono uppercase tracking-wider text-stone-400">
                                        {pos.direction_compound.compound.label}
                                      </span>
                                      <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-[13px] text-stone-300">
                                        {pos.direction_compound.compound.formula}
                                      </span>
                                    </div>
                                    <p className="text-base text-stone-300 font-normal leading-relaxed">
                                      {pos.direction_compound.compound.summary}
                                    </p>
                                  </div>
                                )}

                                <div className="space-y-2.5">
                                  <div className="text-[13px] font-mono uppercase tracking-wider text-stone-400">
                                    Где эта связка может быть плодотворной
                                  </div>
                                  {pos.direction_compound.possible_forms.map((form, formIndex) => (
                                    <div key={formIndex} className="flex items-start gap-3 text-base text-stone-300 leading-relaxed">
                                      <span className="mt-[0.7em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-antique-gold)]" />
                                      <span>{form}</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex flex-col gap-1.5 rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-base sm:flex-row sm:gap-3">
                                  <span className="text-amber-300/90 font-medium sm:min-w-[190px] flex-shrink-0">
                                    Возможное искажение:
                                  </span>
                                  <span className="text-stone-300 font-normal leading-relaxed">
                                    {pos.direction_compound.distortion}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-3 text-base">
                                  <span className="text-[var(--color-antique-gold)] font-medium sm:min-w-[190px] flex-shrink-0">
                                    Когда эта сила работает:
                                  </span>
                                  <span className="text-stone-300 font-normal leading-relaxed">
                                    {pos.strong_form}
                                  </span>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-3 text-base">
                                  <span className="text-amber-400/90 font-medium sm:min-w-[190px] flex-shrink-0">
                                    Где она начинает мешать:
                                  </span>
                                  <span className="text-stone-300 font-normal leading-relaxed">
                                    {pos.shadow}
                                  </span>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-3 text-base">
                                  <span className="text-purple-300/90 font-medium sm:min-w-[190px] flex-shrink-0">
                                    Главная ловушка:
                                  </span>
                                  <span className="text-stone-300 font-normal leading-relaxed">
                                    {pos.tension}
                                  </span>
                                </div>
                              </>
                            )}

                            {pos.environment_parameters && Object.keys(pos.environment_parameters).length > 0 && (
                              <details className="group border-t border-white/5 pt-3">
                                <summary className="cursor-pointer list-none text-[13px] font-mono uppercase tracking-wider text-stone-400 transition-colors hover:text-stone-200">
                                  <span className="group-open:hidden">В какой среде раскрывается это Направление</span>
                                  <span className="hidden group-open:inline">Скрыть параметры среды</span>
                                </summary>
                                <div className="mt-3 space-y-3">
                                  {Object.entries(pos.environment_parameters).map(([label, description]) => (
                                    <div key={label} className="grid gap-1 sm:grid-cols-[190px_1fr] sm:gap-3 text-base">
                                      <span className="text-[var(--color-antique-gold)] font-medium">{label}:</span>
                                      <span className="text-stone-300 font-normal leading-relaxed">{description}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {pos.life_scenes && pos.life_scenes.length > 0 && (
                              <div className="pt-3 border-t border-white/5 space-y-2.5">
                                <div className="text-[13px] font-mono uppercase tracking-wider text-stone-400 mb-2">
                                  Ситуации из жизни:
                                </div>
                                {pos.life_scenes.map((scene, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="p-3.5 bg-black/40 rounded-xl border border-white/5 text-base text-stone-300 font-normal leading-relaxed"
                                  >
                                    <div className="font-medium text-[var(--color-antique-gold)] mb-1 text-[13px]">
                                      {scene.title}
                                    </div>
                                    <div>{scene.description}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Progressive disclosure & position reaction controls */}
                      <div className="code-room-actions flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleDetails(pos.position)}
                          aria-expanded={isExpanded}
                          aria-controls={`code-details-${pos.position}`}
                          className="min-h-11 text-sm text-stone-300 hover:text-[var(--color-antique-gold)] flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {isExpanded
                              ? 'Свернуть'
                              : `Подробности (${pos.life_scenes?.length || 0})`}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {!isExample && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkReaction(
                                  pos.position,
                                  'confirmed',
                                  `${pos.public_name} (${pos.energy}): ${getFirstSentence(publicEssence)}`
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer ${
                                posReaction === 'confirmed'
                                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                                  : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
                              }`}
                            >
                              Похоже
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkReaction(
                                  pos.position,
                                  'rejected',
                                  `${pos.public_name} (${pos.energy}): ${getFirstSentence(publicEssence)}`
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer ${
                                posReaction === 'rejected'
                                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                                  : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
                              }`}
                            >
                              Не похоже
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onOpenAlbert(payload, {
                                  userQuestion: localQuestion.trim() || undefined,
                                  initialPrompt: `Хочу уточнить позицию «${pos.public_name}» (${pos.energy}): в моём опыте это проявляется иначе.`
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-[var(--color-antique-gold)]/40 text-stone-300 text-xs transition-colors cursor-pointer"
                            >
                              Уточнить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {onContinue && (
              <div className="rounded-2xl border border-white/10 p-6 space-y-3">
                <button
                  type="button"
                  onClick={() => { if (!isExample) reportPathEvent('bridge_clicked'); onContinue(); }}
                  className="min-h-[44px] px-5 py-3 rounded-xl bg-[var(--color-antique-gold)] text-[#111622] cursor-pointer font-medium"
                >
                  {continueLabel}
                </button>
              </div>
            )}

            {/* 5. KEY CONNECTIONS (EXPANDABLE ON DEMAND) */}
            <section className="w-full bg-[#0D1322]/80 border border-white/5 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
              <button
                type="button"
                onClick={() => toggleDetails('interactions')}
                className="w-full flex items-center justify-between text-left cursor-pointer"
              >
                <h2 className="font-serif text-xl sm:text-2xl text-stone-100 font-light">
                  Связи чисел ({payload.interactions.length})
                </h2>
                {expandedDetails['interactions'] ? (
                  <ChevronUp className="w-4 h-4 text-stone-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-400" />
                )}
              </button>

              {expandedDetails['interactions'] && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {payload.interactions.map((inter, idx) => (
                    <div
                      key={idx}
                      className="bg-black/30 border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col justify-between transition-all"
                    >
                      <div>
                        {isQaEffective && (
                          <div className="text-[13px] font-mono text-stone-400 mb-2">
                            {inter.category} · {inter.positions_label}
                          </div>
                        )}
                        <h4 className="font-serif text-lg text-stone-100 font-light mb-3 leading-snug">
                          {inter.heading}
                        </h4>
                        <p className="text-xs text-stone-300 font-normal leading-relaxed">
                          {getFirstSentence(inter.meaning)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 8. ALBERT FINAL INVITATION */}
            <section className="w-full bg-gradient-to-br from-[#121A2A] via-[#0E1524] to-[#0A0E18] border border-[var(--color-antique-gold)]/30 rounded-2xl p-6 sm:p-8 relative shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle_at_top_right,rgba(200,164,93,0.12),transparent_70%)] pointer-events-none" />

              <div className="flex flex-col items-start gap-5 relative z-10">
                <div className="max-w-xl">
                  <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-2">
                    Альберт — собеседник по вашей карте
                  </h3>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      aria-label="Поговорить с Альбертом"
                      onClick={() => {
                        if (isExample) {
                          onChangeDate?.();
                          return;
                        }
                        onOpenAlbert(payload, {
                          userQuestion: localQuestion.trim() || undefined
                        });
                      }}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl border border-[var(--color-antique-gold)]/40 text-stone-200 text-sm hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center gap-2.5 min-h-11"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{isExample ? 'Ввести свою дату для беседы' : 'Обсудить с Альбертом здесь'}</span>
                    </button>
                    <span className="text-xs text-stone-400 mt-1.5">
                      {isExample ? 'Альберт обсудит карту вашей даты' : 'Разговор откроется на сайте'}
                    </span>
                  </div>

                </div>
              </div>
            </section>

            {/* 9. ALBERT BRIDGE TO PERSONAL MYTH */}
            {onOpenMyth && (
              <section className="w-full bg-gradient-to-br from-[#121A2A] via-[#0E1524] to-[#0A0E18] border border-[var(--color-antique-gold)]/30 rounded-2xl p-6 sm:p-8 relative shadow-2xl overflow-hidden">
                <div className="border-l-2 border-[var(--color-antique-gold)]/50 pl-4 space-y-3">
                  <span className="block text-xs uppercase tracking-wider text-[var(--color-antique-gold)]/90 font-mono">
                    Альберт — ИИ-собеседник
                  </span>
                  <p className="text-sm sm:text-base text-stone-200 leading-relaxed font-serif">
                    Мы посмотрели на пять сторон жизни через образы чисел. Что из этого вам знакомо — решаете вы. А если хочется обратиться к тому, что происходит сейчас, ответьте на три вопроса. По вашим ответам будет создан Личный миф.
                  </p>
                </div>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={onOpenMyth}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-antique-gold)] to-[#D4B26F] text-[#111622] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-amber-950/30 whitespace-nowrap min-h-11"
                  >
                    <span>Начать Личный миф</span>
                  </button>
                  {freeWindowLine && <p data-testid="bridge-free-window" className="mt-3 text-xs text-stone-400">{freeWindowLine}</p>}
                </div>
              </section>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
