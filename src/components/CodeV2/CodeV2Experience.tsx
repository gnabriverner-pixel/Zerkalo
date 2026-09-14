import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CodeV2Payload, CodeV2Position, CodeV2Interaction } from '../../types';
import { EmblemPlate } from '../../art/emblem';
import { validateBirthDate } from '../../services/birthDate';
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Check,
  AlertCircle,
  Compass,
  MessageSquare,
  Loader2,
  Sparkles,
  Eye,
  RotateCcw,
  Shield,
  Layers
} from 'lucide-react';

interface CodeV2ExperienceProps {
  initialDate?: string;
  isQaMode?: boolean;
  onOpenAlbert: (payload: CodeV2Payload) => void;
  onBackToCollection?: () => void;
  onSwitchToV1?: () => void;
}

const PRESET_DOBS = [
  { label: '06.05.1986', note: 'Венера 6 / Сатурн 8' },
  { label: '06.09.1991', note: 'Венера 6 / Марс 9' },
  { label: '18.12.1989', note: 'Марс 9 / Солнце 3' },
  { label: '01.10.1990', note: 'Солнце 1 / Луна 3' }
];

export function CodeV2Experience({
  initialDate = '',
  isQaMode = false,
  onOpenAlbert,
  onBackToCollection,
  onSwitchToV1
}: CodeV2ExperienceProps) {
  const [day, setDay] = useState(() => (initialDate ? initialDate.split('.')[0] || '' : ''));
  const [month, setMonth] = useState(() => (initialDate ? initialDate.split('.')[1] || '' : ''));
  const [year, setYear] = useState(() => (initialDate ? initialDate.split('.')[2] || '' : ''));

  const [dateError, setDateError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CodeV2Payload | null>(null);

  // Expanded UI states
  const [showCalcChain, setShowCalcChain] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const fetchV2Calculation = async (fullDob: string) => {
    setIsLoading(true);
    setApiError(null);
    setDateError('');

    try {
      const resp = await fetch('/api/preview/code-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dob: fullDob })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.message || 'Не удалось рассчитать карту V2');
      }

      const data = await resp.json();
      if (data.status !== 'ok' || !data.payload) {
        throw new Error('Некорректный ответ сервиса расчёта V2');
      }

      setPayload(data.payload);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      console.error('Code V2 preview failed:', err);
      setApiError(err.message || 'Ошибка соединения с модулем расчёта');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-calculate on initial load only if date is explicitly provided
  useEffect(() => {
    if (!initialDate) return;
    const d = day.padStart(2, '0');
    const m = month.padStart(2, '0');
    const y = year;
    const validation = validateBirthDate(d, m, y);
    if (validation.valid) {
      fetchV2Calculation(validation.formatted);
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

  const toggleScene = (posName: string) => {
    setExpandedScenes(prev => ({
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
        {/* TOP BAR / OWNER BADGE */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-center justify-between w-full gap-3 mb-8 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-antique-gold)] animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--color-antique-gold)]">
              Digital Code V2 · Предпросмотр {isQaMode && '· QA'}
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
                <span>Открыть классическую версию (V1)</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* HERO TITLE & INTRO */}
        {/* ========================================================= */}
        <div className="text-center max-w-2xl mb-8">
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-stone-100 tracking-tight mb-3">
            Карта Цифрового Кода
          </h1>
          <p className="text-sm sm:text-base text-stone-300 font-light leading-relaxed">
            Пять устойчивых ролей, внутренняя механика характера и ключевые динамические связи между ними.
          </p>
        </div>

        {/* ========================================================= */}
        {/* DATE INPUT & QUICK PRESETS */}
        {/* ========================================================= */}
        <div className="w-full max-w-xl bg-[#0E1422]/90 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md mb-12">
          
          {/* Quick presets for acceptance - only in QA mode */}
          {isQaMode && (
            <div className="mb-5 p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300/80 mb-2.5 flex items-center justify-between">
                <span>Контрольные даты для проверки (QA Режим):</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">qa=1</span>
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
                      <div className="text-[10px] text-stone-400 truncate">{preset.note}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleCalculate} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="grid grid-cols-3 gap-2 flex-grow">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
                  День
                </label>
                <input
                  ref={dayRef}
                  type="text"
                  maxLength={2}
                  value={day}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setDay(val);
                    if (val.length === 2) monthRef.current?.focus();
                  }}
                  placeholder="ДД"
                  className="w-full text-center bg-black/40 border border-white/10 focus:border-[var(--color-antique-gold)] rounded-xl py-2.5 text-base font-mono text-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
                  Месяц
                </label>
                <input
                  ref={monthRef}
                  type="text"
                  maxLength={2}
                  value={month}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setMonth(val);
                    if (val.length === 2) yearRef.current?.focus();
                  }}
                  placeholder="ММ"
                  className="w-full text-center bg-black/40 border border-white/10 focus:border-[var(--color-antique-gold)] rounded-xl py-2.5 text-base font-mono text-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
                  Год
                </label>
                <input
                  ref={yearRef}
                  type="text"
                  maxLength={4}
                  value={year}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setYear(val);
                  }}
                  placeholder="ГГГГ"
                  className="w-full text-center bg-black/40 border border-white/10 focus:border-[var(--color-antique-gold)] rounded-xl py-2.5 text-base font-mono text-white outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[46px] px-6 rounded-xl bg-gradient-to-r from-[var(--color-antique-gold)] to-[#D4B26F] text-[#111622] font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-950/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Расчёт...</span>
                </>
              ) : (
                <>
                  <span>Рассчитать</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {dateError && (
            <div className="mt-3 text-xs text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{dateError}</span>
            </div>
          )}

          {apiError && (
            <div className="mt-3 text-xs text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}
        </div>

        {/* Helper invitation when payload is not yet calculated */}
        {!payload && !isLoading && (
          <div className="w-full max-w-xl text-center py-10 px-6 bg-white/[0.02] border border-white/5 rounded-2xl mb-12">
            <Compass className="w-8 h-8 text-[var(--color-antique-gold)]/60 mx-auto mb-3" />
            <p className="text-sm text-stone-300 font-light leading-relaxed mb-2">
              Укажите дату рождения, чтобы рассчитать пять позиций Цифрового Кода.
            </p>
            <p className="text-xs text-stone-500 font-light leading-relaxed">
              Вы увидите внутренний исток, способ проявления, механизм действия, развивающую среду и зрелую интеграцию характера.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* RESULTS WRAPPER */}
        {/* ========================================================= */}
        {payload && (
          <div ref={resultsRef} className="w-full space-y-12">
            
            {/* ======================================================= */}
            {/* ACT 1: ARRIVAL & METHOD ORIENTATION (WITH 5 NUMBERS)    */}
            {/* ======================================================= */}
            <section className="w-full bg-[#0D1322]/90 border border-[var(--color-antique-gold)]/25 rounded-2xl p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle_at_top_right,rgba(200,164,93,0.08),transparent_70%)] pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] block mb-1">
                    Акт 1 · Ориентация и пять чисел карты
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                    Как устроен ваш Цифровой Код ({payload.calculation.date})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCalcChain(!showCalcChain)}
                  className="self-start sm:self-auto text-xs font-mono text-stone-300 hover:text-[var(--color-antique-gold)] border border-white/10 hover:border-[var(--color-antique-gold)]/40 rounded-xl px-3.5 py-2 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{showCalcChain ? 'Скрыть ход расчёта' : 'Откуда взялись эти числа?'}</span>
                  {showCalcChain ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-sm sm:text-base text-stone-200 leading-relaxed mb-6 font-light">
                {payload.method_orientation.summary}
              </p>

              {/* 5-NUMBER RIBBON */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                {payload.positions.map((pos) => (
                  <div
                    key={pos.position}
                    className="bg-black/40 border border-white/10 hover:border-[var(--color-antique-gold)]/30 rounded-xl p-3.5 transition-all flex flex-col items-center text-center shadow-inner"
                  >
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-1 truncate w-full">
                      {pos.public_name.replace('Число ', '')}
                    </span>
                    <div className="font-serif text-3xl sm:text-4xl text-amber-100 font-light leading-none my-1">
                      {pos.energy}
                    </div>
                    <div className="text-[11px] text-[var(--color-antique-gold)] font-medium">
                      {pos.energy_name}
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 mt-1">
                      {pos.compound_route ? `маршрут ${pos.compound_route}` : `код ${pos.energy}`}
                    </div>
                    <div className="text-[10px] text-stone-400 font-sans italic mt-1 text-center line-clamp-1">
                      {pos.role}
                    </div>
                  </div>
                ))}
              </div>

              {/* EXPANDABLE ARITHMETIC CHAIN */}
              <AnimatePresence>
                {showCalcChain && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mb-6 pt-5 border-t border-white/10 overflow-hidden"
                  >
                    <div className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-3">
                      Пошаговая прозрачная цепочка вычислений:
                    </div>
                    <div className="space-y-2.5">
                      {payload.calculation.calculation_chain.map((step, idx) => (
                        <div
                          key={step.position}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/3 rounded-xl border border-white/5 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-white/10 text-stone-300 font-mono text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-stone-200">{step.public_name}:</span>
                            <span className="text-stone-400">{step.formula_label}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <code className="font-mono text-amber-200 bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
                              {step.calculation}
                            </code>
                            <span className="text-[11px] text-stone-400 hidden md:inline">
                              {step.rule}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* EPISTEMIC CONTOUR & BASE LAW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                  <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-antique-gold)] mb-1.5 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Эпистемический контур</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed font-light">
                    {payload.method_orientation.epistemic_frame}
                  </p>
                </div>

                <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                  <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-antique-gold)] mb-1.5 flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Базовый закон</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed font-light">
                    {payload.method_orientation.core_law}
                  </p>
                </div>
              </div>

              {/* 5 TARGET QUESTIONS */}
              <div className="pt-4 border-t border-white/5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-3">
                  Пять сквозных исследовательских вопросов карты:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  {payload.method_orientation.target_questions.map(tq => (
                    <div key={tq.position} className="p-3 bg-white/2 rounded-xl border border-white/5 text-xs">
                      <div className="font-medium text-[var(--color-antique-gold)] text-[11px] mb-1">
                        {tq.position}
                      </div>
                      <div className="text-stone-300 font-serif italic text-xs leading-snug">
                        {tq.question}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ======================================================= */}
            {/* ACT 2: CENTRAL PSYCHOLOGICAL MOTIF                     */}
            {/* ======================================================= */}
            <section className="w-full bg-gradient-to-br from-[#12192B] to-[#0A0E18] border border-[var(--color-antique-gold)]/30 rounded-2xl p-6 sm:p-8 relative shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[var(--color-antique-gold)]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)]">
                  Акт 2 · Главный нерв карты
                </span>
              </div>

              <h3 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-4">
                Центральный мотив и внутренний контраст
              </h3>

              <div className="pl-4 border-l-2 border-[var(--color-antique-gold)]/60 text-sm sm:text-base text-stone-200 leading-relaxed font-light space-y-3">
                {payload.synthesis.strongest_motif.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              {/* Contextual Albert callout immediately after central motif (Section 8.F) */}
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-300">
                <span className="font-light">
                  Альберт уже знает этот центральный узел и готов проверить его на вашей ситуации.
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAlbert(payload)}
                  className="self-start sm:self-auto text-[11px] font-mono text-[var(--color-antique-gold)] hover:text-amber-200 border border-[var(--color-antique-gold)]/30 hover:border-[var(--color-antique-gold)] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Обсудить узел с Альбертом</span>
                </button>
              </div>
            </section>

            {/* ======================================================= */}
            {/* ACT 4: 5 PROGRESSIVE POSITION CARDS */}
            {/* ======================================================= */}
            <section className="w-full space-y-6">
              <div className="text-center max-w-xl mx-auto mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] block mb-1">
                  Акт 3 · Разбор пяти ролей
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                  Анатомия психологических механизмов
                </h2>
              </div>

              <div className="space-y-6">
                {payload.positions.map((pos) => {
                  const isScenesOpen = !!expandedScenes[pos.position];
                  return (
                    <div
                      key={pos.position}
                      className="w-full bg-[#0D1322]/90 border border-white/10 hover:border-white/20 rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-all shadow-lg"
                    >
                      {/* CARD HEADER */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5 pb-5 border-b border-white/5">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <EmblemPlate planet={pos.energy} variant="obsidian" size={64} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-antique-gold)]">
                                {pos.public_name} · {pos.role}
                              </span>
                              {pos.compound_route && (
                                <span className="text-[10px] font-mono text-stone-400 bg-white/5 px-2 py-0.5 rounded-full">
                                  Маршрут {pos.compound_route}
                                </span>
                              )}
                            </div>
                            <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light">
                              {pos.energy_name} · {pos.energy}
                            </h3>
                            <div className="text-xs sm:text-sm font-serif italic text-stone-300 mt-1">
                              «{pos.role_question}»
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap sm:flex-col items-end gap-1.5">
                          <span className="text-xs font-mono bg-[var(--color-antique-gold)]/10 text-amber-200 border border-[var(--color-antique-gold)]/25 px-2.5 py-1 rounded-lg">
                            {pos.headline_mechanism}
                          </span>
                          {pos.mechanism_names.filter(m => m !== pos.headline_mechanism).map(m => (
                            <span key={m} className="text-[10px] font-mono text-stone-400 bg-white/5 px-2 py-0.5 rounded-md">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* ESSENCE */}
                      <div className="mb-6">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1.5">
                          Психологическая суть:
                        </div>
                        <p className="text-sm sm:text-base text-stone-200 font-light leading-relaxed">
                          {pos.essence}
                        </p>
                      </div>

                      {/* BALANCE & POLARITIES (Strong / Shadow / Tension) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        <div className="p-4 bg-emerald-950/15 border border-emerald-500/20 rounded-xl">
                          <div className="text-xs font-mono uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>Сильная форма</span>
                          </div>
                          <p className="text-xs text-stone-300 font-light leading-relaxed">
                            {pos.strong_form}
                          </p>
                        </div>

                        <div className="p-4 bg-amber-950/15 border border-amber-500/20 rounded-xl">
                          <div className="text-xs font-mono uppercase tracking-wider text-amber-300 mb-1 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Теневая форма</span>
                          </div>
                          <p className="text-xs text-stone-300 font-light leading-relaxed">
                            {pos.shadow}
                          </p>
                        </div>

                        <div className="p-4 bg-purple-950/15 border border-purple-500/20 rounded-xl">
                          <div className="text-xs font-mono uppercase tracking-wider text-purple-300 mb-1 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            <span>Точка напряжения</span>
                          </div>
                          <p className="text-xs text-stone-300 font-light leading-relaxed">
                            {pos.tension}
                          </p>
                        </div>
                      </div>

                      {/* EXPANDABLE LIFE SCENES */}
                      {pos.life_scenes && pos.life_scenes.length > 0 && (
                        <div className="pt-4 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => toggleScene(pos.position)}
                            className="text-xs font-mono text-stone-300 hover:text-[var(--color-antique-gold)] flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>
                              {isScenesOpen
                                ? 'Скрыть проявления в жизни'
                                : `Показать ситуации в жизни (${pos.life_scenes.length})`}
                            </span>
                            {isScenesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <AnimatePresence>
                            {isScenesOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-4 space-y-2.5 overflow-hidden"
                              >
                                {pos.life_scenes.map((scene, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="p-3.5 bg-black/30 rounded-xl border border-white/5 text-xs text-stone-300 font-light leading-relaxed"
                                  >
                                    <div className="font-medium text-stone-200 mb-1 text-[11px] font-mono text-[var(--color-antique-gold)]">
                                      {scene.title}
                                    </div>
                                    <div>{scene.description}</div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* SELF-CHECK VERIFICATION QUESTION */}
                      <div className="mt-5 p-3.5 bg-white/2 border border-white/5 rounded-xl flex items-start gap-3">
                        <Compass className="w-4 h-4 text-[var(--color-antique-gold)] flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-0.5">
                            Вопрос для личной калибровки:
                          </span>
                          <p className="text-xs text-stone-200 font-serif italic leading-relaxed">
                            {pos.verification_question}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ======================================================= */}
            {/* ======================================================= */}
            {/* ACT 4: KEY CONNECTIONS (1-3 INTERACTIONS WITHOUT DEBUG) */}
            {/* ======================================================= */}
            <section className="w-full bg-[#0D1322]/90 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
              <div className="max-w-2xl mb-6">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] block mb-1">
                  Акт 4 · Ключевые взаимодействия в карте
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-2">
                  Как спорят и поддерживают друг друга числа
                </h2>
                <p className="text-xs sm:text-sm text-stone-300 font-light leading-relaxed">
                  Характер определяется не отдельными числами, а узлами трения и опоры между ними.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {payload.interactions.map((inter, idx) => {
                  const isTension = inter.category.includes('напряжение') || inter.category.includes('конфликт');
                  return (
                    <div
                      key={idx}
                      className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-5 flex flex-col justify-between transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              isTension
                                ? 'bg-amber-950/30 text-amber-300 border-amber-500/25'
                                : 'bg-emerald-950/30 text-emerald-300 border-emerald-500/25'
                            }`}
                          >
                            {inter.category}
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            {inter.positions_label}
                          </span>
                        </div>

                        <h4 className="font-serif text-lg text-stone-100 font-light mb-2 leading-snug">
                          {inter.heading}
                        </h4>

                        <div className="text-xs text-stone-400 font-serif italic mb-3">
                          {inter.relation_question}
                        </div>

                        <p className="text-xs text-stone-300 font-light leading-relaxed mb-4">
                          {inter.meaning}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ======================================================= */}
            {/* ACT 5: ENVIRONMENT & MATURE INTEGRATION */}
            {/* ======================================================= */}
            <section className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* ENVIRONMENT CARD */}
              <div className="bg-[#0D1322]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] block mb-1">
                    Акт 5.1 · Среда развития
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-1">
                    {payload.synthesis.environment.title}
                  </h3>
                  <div className="text-xs text-stone-400 font-mono mb-4">
                    Энергия среды: {payload.synthesis.environment.energy_name}
                  </div>

                  {payload.synthesis.environment.parameters && (
                    <div className="space-y-2 mb-4">
                      {Object.entries(payload.synthesis.environment.parameters).slice(0, 4).map(([k, v]) => (
                        <div key={k} className="text-xs p-2.5 bg-black/30 rounded-lg border border-white/5">
                          <span className="font-mono text-[var(--color-antique-gold)] text-[11px] block mb-0.5">
                            {k}:
                          </span>
                          <span className="text-stone-300 font-light">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-stone-300 font-light leading-relaxed">
                    {payload.synthesis.environment.summary.split('\n\n')[0]}
                  </p>
                </div>
              </div>

              {/* MATURE INTEGRATION CARD */}
              <div className="bg-[#0D1322]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] block mb-1">
                    Акт 5.2 · Зрелая интеграция
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl text-stone-100 font-light mb-1">
                    {payload.synthesis.mature_integration.title}
                  </h3>
                  <div className="text-xs text-stone-400 font-mono mb-4">
                    Вектор зрелости: {payload.synthesis.mature_integration.energy_name}
                  </div>

                  <p className="text-xs sm:text-sm text-stone-300 font-light leading-relaxed mb-4">
                    {payload.synthesis.mature_integration.summary.split('\n\n')[0]}
                  </p>

                  <div className="p-3.5 bg-white/2 rounded-xl border border-white/5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
                      Точка сборки характера:
                    </div>
                    <p className="text-xs text-stone-200 font-light leading-relaxed">
                      {payload.synthesis.mature_integration.summary.split('\n\n')[1] || 'Сбалансированное использование всех механизмов карты без впадения в теневые крайности.'}
                    </p>
                  </div>
                </div>
              </div>

            </section>

            {/* ======================================================= */}
            {/* ACT 6: PERSONAL VERIFICATION QUESTIONS */}
            {/* ======================================================= */}
            <section className="w-full bg-[#0D1322]/90 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)] block mb-1">
                Акт 6 · Личная верификация
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-3">
                Вопросы для честной проверки карты
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 font-light leading-relaxed mb-6">
                Любая психологическая модель полезна настолько, насколько она выдерживает столкновение с вашим реальным опытом. Проверьте эти развилки:
              </p>

              <div className="space-y-3 mb-4">
                {payload.verification.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-black/30 rounded-xl border border-white/5 flex items-start gap-3.5"
                  >
                    <span className="w-6 h-6 rounded-full bg-[var(--color-antique-gold)]/10 text-amber-200 font-mono text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-stone-200 font-serif italic leading-relaxed">
                      «{q}»
                    </p>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-stone-400 font-light">
                Если вы не согласны с какими-то формулировками или узнаёте себя лишь отчасти — это лучший повод разобрать расхождение с Альбертом.
              </div>
            </section>

            {/* ======================================================= */}
            {/* ACT 7: CONTEXTUAL ALBERT HANDOFF */}
            {/* ======================================================= */}
            <section className="w-full bg-gradient-to-br from-[#121A2A] via-[#0E1524] to-[#0A0E18] border border-[var(--color-antique-gold)]/40 rounded-2xl p-6 sm:p-8 relative shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle_at_top_right,rgba(200,164,93,0.12),transparent_70%)] pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_8px_rgba(200,164,93,0.6)]" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-antique-gold)]">
                      Собеседник Альберт · Диалоговый вход
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 font-light mb-2">
                    Альберт — проводник по вашей карте
                  </h3>

                  <p className="text-sm sm:text-base text-stone-200 font-light leading-relaxed mb-3">
                    Он не будет пересказывать числа. Он поможет проверить, что действительно про вас, а что требует уточнения.
                  </p>

                  <blockquote className="text-xs sm:text-sm text-stone-300 font-serif italic border-l-2 border-[var(--color-antique-gold)] pl-3 mb-3 leading-relaxed">
                    {payload.albert_context.albert_canonical_quote}
                  </blockquote>

                  <p className="text-xs sm:text-sm text-stone-400 font-light leading-relaxed">
                    {payload.albert_context.opening_statement}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenAlbert(payload)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-antique-gold)] to-[#D4B26F] text-[#111622] font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 shadow-xl shadow-amber-950/30 whitespace-nowrap"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Поговорить с Альбертом о моей карте</span>
                </button>
              </div>
            </section>

          </div>
        )}

      </div>
    </div>
  );
}
