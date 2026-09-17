import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CodeV2Payload, CodeV2Position, CodeV2Interaction } from '../../types';
import { EmblemPlate } from '../../art/emblem';
import { hasCanonicalV2Result } from '../../services/codeV2Session';
import { validateBirthDate } from '../../services/birthDate';
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
  RotateCcw,
  AlertCircle
} from 'lucide-react';

interface CodeV2ExperienceProps {
  initialDate?: string;
  initialPayload?: CodeV2Payload;
  initialExpanded?: Record<string, boolean>;
  isQaMode?: boolean;
  onOpenAlbert: (payload: CodeV2Payload) => void;
  onCalculated?: (payload: CodeV2Payload) => void;
  onChangeDate?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  onBackToCollection?: () => void;
  onSwitchToV1?: () => void;
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

const PRESET_DOBS = [
  { label: '06.05.1986', note: 'Венера 6 / Сатурн 8' },
  { label: '06.09.1991', note: 'Венера 6 / Сатурн 8 (усиление)' },
  { label: '18.12.1989', note: 'Марс 9 / Юпитер 3' },
  { label: '01.10.1990', note: 'Солнце 1 / Юпитер 3' }
];

export function CodeV2Experience({
  initialDate = '',
  initialPayload,
  initialExpanded,
  isQaMode = false,
  onOpenAlbert,
  onCalculated,
  onChangeDate,
  onContinue,
  continueLabel = 'Перейти к Личному мифу',
  onBackToCollection,
  onSwitchToV1
}: CodeV2ExperienceProps) {
  const [day, setDay] = useState(() => (initialDate ? initialDate.split('.')[0] || '' : ''));
  const [month, setMonth] = useState(() => (initialDate ? initialDate.split('.')[1] || '' : ''));
  const [year, setYear] = useState(() => (initialDate ? initialDate.split('.')[2] || '' : ''));

  const [dateError, setDateError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CodeV2Payload | null>(initialPayload || null);

  // Progressive disclosure states (collapsed by default to achieve 450-700 words budget)
  const [showCalcChain, setShowCalcChain] = useState(false);
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
      const resp = await fetch('/api/code-v2', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dob: fullDob })
      });

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
      onCalculated?.(data.payload);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Code calculation failed:', err);
      setApiError(err.message || 'Ошибка соединения с модулем расчёта');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  // Auto-calculate on initial load only if date is explicitly provided
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
      const validation = validateBirthDate(d, m, y);
      if (validation.valid) {
        fetchV2Calculation(validation.formatted);
      }
    }
  }, [initialDate]);

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

    setDay(d);
    setMonth(m);
    setYear(y);
    fetchV2Calculation(validation.formatted);
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
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(200,164,93,0.12)_0%,transparent_70%)]" />
        <div className="absolute bottom-1/3 left-1/3 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(60,80,120,0.1)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 flex flex-col items-center">
        
        {/* ========================================================= */}
        {/* TOP BAR - QA MODE ONLY */}
        {/* ========================================================= */}
        {isQaMode && (
          <div className="flex flex-wrap items-center justify-between w-full gap-3 mb-8 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-antique-gold)] animate-pulse" />
              <span className="text-[13px] font-mono tracking-widest uppercase text-[var(--color-antique-gold)]">
                Digital Code V2 · QA Режим
              </span>
            </div>

            <div className="flex items-center gap-3">
              {onSwitchToV1 && (
                <button
                  type="button"
                  onClick={onSwitchToV1}
                  className="text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Переключить на V1</span>
                </button>
              )}
            </div>
          </div>
        )}

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
                Ваш Цифровой Код
              </h1>
              <div className="text-sm sm:text-base text-stone-300 font-normal leading-relaxed max-w-lg mx-auto space-y-3">
                <p>
                  Посмотрите на привычную ситуацию с неожиданной стороны.
                </p>
                <p className="text-stone-400 text-xs sm:text-sm">
                  По дате рождения мы предложим символическую карту. Вы сможете узнать в ней что-то своё, уточнить или не согласиться — ваш опыт важнее описания.
                </p>
              </div>
            </div>

            {/* QA Presets: Only shown if isQaMode */}
            {isQaMode && (
              <div className="w-full mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                <div className="text-[13px] font-mono uppercase tracking-wider text-amber-300/80 mb-3 flex items-center justify-between">
                  <span>Контрольные даты для проверки (QA Режим):</span>
                  <span className="text-[13px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">qa=1</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_DOBS.map(preset => {
                    const isActive = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}` === preset.label;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSelectPreset(preset.label)}
                        className={`px-3 py-2 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'bg-[var(--color-antique-gold)]/15 border-[var(--color-antique-gold)] text-amber-200 shadow-sm'
                            : 'bg-white/5 border-white/5 hover:border-white/15 text-stone-300 hover:text-stone-100'
                        }`}
                      >
                        <div className="text-xs font-mono font-medium">{preset.label}</div>
                        <div className="text-[13px] text-stone-400 truncate">{preset.note}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
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
                      <span>Открыть мой Код</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

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
            
            {/* Minimal date indicator with edit link */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 text-xs text-stone-400">
              <div className="flex items-center gap-2">
                <span className="font-serif text-stone-200 text-sm">Ваш Цифровой Код</span>
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
                Изменить дату
              </button>
            </div>

            {/* 1. HERO OPENING: FIVE NUMBERS & CENTRAL MOTIF (MEANING FIRST) */}
            <section className="w-full bg-gradient-to-br from-[#12192B] via-[#0E1524] to-[#0A0E18] border border-[var(--color-antique-gold)]/30 rounded-3xl p-6 sm:p-9 relative shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(circle_at_top_right,rgba(200,164,93,0.12),transparent_70%)] pointer-events-none" />

              {/* Celestial Immersion Intro */}
              <div className="text-center max-w-xl mx-auto mb-8 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-antique-gold)]/10 border border-[var(--color-antique-gold)]/25 text-[13px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] mb-3">
                  <Sparkles className="w-3 h-3" />
                  <span>Символический язык карты</span>
                </div>
                <h1 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-2">
                  Девять светил и пять координат
                </h1>
                <p className="text-xs sm:text-sm text-stone-300 font-normal leading-relaxed">
                  В языке ведической нумерологии числа связаны с девятью светилами. Дата преобразуется в пять координат карты — это символические гипотезы о внутреннем запросе, способе действия и зрелой сборке. Проверьте их по своему опыту: совпадение не предполагается заранее.
                </p>
              </div>

              {/* A. Five Numbers Visually (Editorial Typographic Strip) */}
              <div className="flex flex-col items-center text-center mb-7 relative z-10">
                <div className="text-[13px] sm:text-sm font-mono tracking-widest uppercase text-[var(--color-antique-gold)]/80 mb-3">
                  Пять позиций вашей карты
                </div>

                <div className="flex items-center justify-center gap-2 sm:gap-6 flex-wrap py-2">
                  {payload.positions.map((pos, idx) => (
                    <React.Fragment key={pos.position}>
                      <div className="flex flex-col items-center px-1.5 sm:px-3">
                        <span className="font-serif text-3xl sm:text-5xl text-amber-100 font-light leading-none">
                          {pos.energy}
                        </span>
                        <span className="text-[13px] sm:text-sm text-[var(--color-antique-gold)] font-medium mt-1.5">
                          {pos.energy_name}
                        </span>
                        <span className="text-[13px] font-mono text-stone-300 uppercase tracking-wider mt-0.5">
                          {pos.public_name.replace('Число ', '')}
                        </span>
                      </div>
                      {idx < payload.positions.length - 1 && (
                        <span className="text-stone-600 text-lg sm:text-2xl font-normal select-none pb-4 sm:pb-5">·</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* B & C. Central Human Motif (Heading + Why It Matters) */}
              <div className="pt-6 border-t border-white/10 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-[13px] sm:text-sm font-mono tracking-widest uppercase text-[var(--color-antique-gold)]/80">
                    Центральный нерв карты
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

                <div className="pl-4 border-l-2 border-[var(--color-antique-gold)]/60 text-base sm:text-[17px] text-stone-200 leading-relaxed font-normal mb-6 space-y-4">
                  <p className="text-stone-400 text-sm">Гипотеза для проверки, а не вывод о вашей личности.</p>
                  {(payload.central_motif || payload.synthesis.strongest_motif || '').split('\n\n').map((paragraph, pIdx) => (
                    <p key={pIdx}>{paragraph}</p>
                  ))}
                </div>

                {/* Quiet Albert Invitation right after central motif */}
                <div className="pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-stone-200 font-medium">
                      Хотите проверить это на себе?
                    </div>
                    <div className="text-xs text-stone-400 font-normal mt-0.5">
                      Альберт уже видит вашу карту.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenAlbert(payload)}
                    className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-[var(--color-antique-gold)]/15 border border-[var(--color-antique-gold)]/40 hover:bg-[var(--color-antique-gold)]/25 text-amber-200 text-xs font-mono transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Обсудить с Альбертом</span>
                  </button>
                </div>
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

            {/* 3. METHOD FRAME - ONE HUMAN BLOCK ONLY */}
            <section className="w-full bg-[#0D1322]/50 border border-white/5 rounded-2xl p-5 sm:p-6 backdrop-blur-sm">
              <div className="font-serif text-lg text-stone-200 font-light mb-2 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[var(--color-antique-gold)]" />
                <span>Как это читать</span>
              </div>
              <p className="text-base text-stone-300 font-normal leading-relaxed max-w-2xl">
                Цифровой Код объединяет строгую математику пропорций и язык небесных архетипов. Это не фатальный диагноз, а инструмент честной саморефлексии — система выверенных гипотез. Исследуйте эту карту внимательно: отмечайте, где ваш опыт безошибочно узнаёт себя, а где возникает желание оспорить формулировку.
              </p>
            </section>

            {/* 4. FIVE POSITIONS - EDITORIAL CHAPTERS */}
            <section className="w-full space-y-6">
              <div className="text-center max-w-xl mx-auto mb-2">
                <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                  Пять позиций вашего кода
                </h2>
                <p className="text-sm text-stone-400 font-normal mt-1">
                  Каждое число отвечает за свой слой жизни и раскрывается по-разному.
                </p>
              </div>

              <div className="space-y-6">
                {payload.positions.map((pos) => {
                  const isExpanded = !!expandedDetails[pos.position];
                  const publicEssence = cleanPositionEssence(pos.essence);
                  return (
                    <div
                      key={pos.position}
                      className="w-full bg-[#0D1322]/80 border border-white/5 hover:border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-all shadow-lg"
                    >
                      {/* Position Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-5 border-b border-white/5">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 pt-0.5">
                            <EmblemPlate planet={pos.energy} variant="obsidian" size={56} />
                          </div>
                          <div>
                            <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-antique-gold)] mb-1">
                              {pos.public_name} · {pos.role}
                            </div>
                            <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                              {pos.energy_name} · {pos.energy}
                            </h3>
                            <div className="text-base font-serif italic text-stone-300 mt-1 leading-relaxed">
                              «{pos.role_question}»
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center self-start sm:self-auto">
                          <span className="text-xs font-mono bg-white/5 text-stone-300 border border-white/10 px-3 py-1 rounded-lg">
                            {pos.headline_mechanism}
                          </span>
                        </div>
                      </div>

                      {/* О чём это число */}
                      <div className="mb-6">
                        <div className="text-xs font-medium text-stone-400 mb-2">
                          О чём это число
                        </div>
                        {pos.position === 'path' && (
                          <p className="mb-3 rounded-xl border border-[var(--color-antique-gold)]/20 bg-[var(--color-antique-gold)]/5 px-4 py-3 text-base text-stone-300 font-normal leading-relaxed">
                            Это не готовая черта характера, а направление практики: способ действовать, который постепенно осваивается через выборы, поступки и повторяющиеся жизненные задачи.
                          </p>
                        )}
                        <p className="text-base sm:text-[17px] text-stone-200 font-normal leading-relaxed">
                          {isExpanded ? publicEssence : getFirstSentence(publicEssence)}
                        </p>
                      </div>

                      {/* Progressive disclosure: Dynamic Forces & Life Scenes */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-3 mb-6 pt-3 border-t border-white/5 overflow-hidden"
                          >
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

                            {pos.environment_parameters && Object.keys(pos.environment_parameters).length > 0 && (
                              <div className="pt-3 border-t border-white/5 space-y-3">
                                <div className="text-[13px] font-mono uppercase tracking-wider text-stone-400">
                                  В какой среде раскрывается это Направление:
                                </div>
                                {Object.entries(pos.environment_parameters).map(([label, description]) => (
                                  <div key={label} className="grid gap-1 sm:grid-cols-[190px_1fr] sm:gap-3 text-base">
                                    <span className="text-[var(--color-antique-gold)] font-medium">{label}:</span>
                                    <span className="text-stone-300 font-normal leading-relaxed">{description}</span>
                                  </div>
                                ))}
                              </div>
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

                      {/* Проверьте на себе */}
                      <div className="p-4 bg-black/30 rounded-xl border border-white/5 flex items-start gap-3 mb-3">
                        <Compass className="w-4 h-4 text-[var(--color-antique-gold)] flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[13px] font-medium text-stone-400 block mb-1">
                            Проверьте на себе:
                          </span>
                          <p className="text-base text-stone-200 font-serif italic leading-relaxed">
                            «{pos.verification_question}»
                          </p>
                        </div>
                      </div>

                      {/* Progressive disclosure trigger */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => toggleDetails(pos.position)}
                          className="text-xs text-stone-400 hover:text-[var(--color-antique-gold)] flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {isExpanded
                              ? 'Свернуть подробности'
                              : `Посмотреть баланс сил и ситуации из жизни (${pos.life_scenes?.length || 0})`}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {onContinue && (
              <div className="rounded-2xl border border-white/10 p-6 space-y-3">
                <h2 className="font-serif text-2xl">Посмотреть с другой стороны</h2>
                <p className="text-sm text-stone-300">Личный миф начинается с ваших слов и образов. Его история не подстраивается под числа.</p>
                <button type="button" onClick={onContinue} className="min-h-[44px] px-5 py-3 rounded-xl bg-[var(--color-antique-gold)] text-[#111622] cursor-pointer">{continueLabel}</button>
              </div>
            )}

            {/* 5. KEY CONNECTIONS */}
            <section className="w-full bg-[#0D1322]/80 border border-white/5 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
              <div className="max-w-2xl mb-6">
                <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-2">
                  Как числа взаимодействуют между собой
                </h2>
                <p className="text-xs sm:text-sm text-stone-400 font-normal leading-relaxed">
                  Характер проявляется в том, как разные силы поддерживают или сдерживают друг друга.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {payload.interactions.map((inter, idx) => (
                  <div
                    key={idx}
                    className="bg-black/30 border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col justify-between transition-all"
                  >
                    <div>
                      {isQaMode && (
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
            </section>

            {/* 8. ALBERT FINAL INVITATION */}
            <section className="w-full bg-gradient-to-br from-[#121A2A] via-[#0E1524] to-[#0A0E18] border border-[var(--color-antique-gold)]/30 rounded-2xl p-6 sm:p-8 relative shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle_at_top_right,rgba(200,164,93,0.12),transparent_70%)] pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                <div className="max-w-xl">
                  <div className="text-[13px] font-mono tracking-widest uppercase text-[var(--color-antique-gold)]/80 mb-2">
                    Диалог по карте
                  </div>
                  <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-3">
                    Альберт — собеседник по вашей карте
                  </h3>
                  <p className="text-sm sm:text-base text-stone-300 font-normal leading-relaxed mb-4">
                    Он не будет пересказывать числа. Он поможет понять, что действительно про вас, а что стоит уточнить или отбросить.
                  </p>
                  {payload.albert_context?.opening_statement && (
                    <p className="text-xs sm:text-sm text-stone-400 font-serif italic pl-3 border-l border-[var(--color-antique-gold)]/50 leading-relaxed">
                      «{payload.albert_context.opening_statement}»
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenAlbert(payload)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-antique-gold)] to-[#D4B26F] text-[#111622] font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 shadow-xl shadow-amber-950/30 whitespace-nowrap"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Поговорить с Альбертом</span>
                </button>
              </div>
            </section>

          </div>
        )}

      </div>
    </div>
  );
}
