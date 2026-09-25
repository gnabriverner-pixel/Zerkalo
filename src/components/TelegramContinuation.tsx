import React, { useEffect, useRef, useState } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import type { ApiResponse, CalculationResult, MeetingOfMirrorsResult } from '../types';
import { acceptConsent } from '../services/consent';
import { useCoreConsent } from './ConsentBoundary';
import { loadTruthState, truthJourneyKey } from '../services/albertTruthState';

interface TelegramContinuationProps {
  codeResult: CalculationResult | null;
  storyResult: ApiResponse['story_result'] | null;
  meetingResult: MeetingOfMirrorsResult | null;
  journeyId?: string;
}

function safeTelegramUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const start = url.searchParams.get('start') || '';
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 't.me' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      [...url.searchParams.keys()].length !== 1 ||
      !/^\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(url.pathname) ||
      !/^h_[A-Za-z0-9_-]{43}$/.test(start)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function TelegramContinuation({ codeResult, storyResult, meetingResult, journeyId }: TelegramContinuationProps) {
  const ensureCoreConsent = useCoreConsent();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [status, setStatus] = useState('');
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status) statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [status]);

  const createTransfer = async () => {
    if (!codeResult || !storyResult || !meetingResult) return;

    setBusy(true);
    setError('');
    setStatus('');
    let telegramTab: Window | null = null;
    try {
      // Open synchronously from the user's click so popup protection does not
      // swallow the Telegram deep link after the consent and claim requests.
      telegramTab = window.open('about:blank', '_blank');
      if (telegramTab) telegramTab.opener = null;
      if (!(await ensureCoreConsent())) {
        telegramTab?.close();
        return;
      }
      await acceptConsent('telegram_transfer');
      const truthState = loadTruthState(journeyId || truthJourneyKey(codeResult, storyResult, meetingResult));
      const response = await fetch('/api/handoff/create-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeResult, storyResult, meetingResult, ...(truthState ? { truthState } : {}) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Переход в Telegram временно недоступен. Результаты останутся на сайте — продолжить можно здесь.');
        }
        if (response.status === 403) {
          throw new Error('Не удалось подтвердить согласие на перенос. Результаты останутся на сайте.');
        }
        throw new Error('Не удалось подготовить перенос. Результаты останутся на сайте — попробуйте позже или продолжите здесь.');
      }

      const safeUrl = safeTelegramUrl(payload?.telegramUrl);
      if (!safeUrl) throw new Error('Сервис не вернул безопасную ссылку Telegram. Результаты остались на сайте.');

      setDialogOpen(false);
      setAccepted(false);
      if (telegramTab && !telegramTab.closed) {
        try {
          telegramTab.location.replace(safeUrl);
          setStatus('Краткий контекст подготовлен. Telegram открыт в новой вкладке.');
        } catch {
          telegramTab.close();
          setTelegramUrl(safeUrl);
          setStatus('Краткий контекст подготовлен. Откройте Telegram по одноразовой ссылке.');
        }
      } else {
        setTelegramUrl(safeUrl);
        setStatus('Краткий контекст подготовлен. Откройте Telegram по одноразовой ссылке.');
      }
    } catch (cause) {
      telegramTab?.close();
      setError(cause instanceof Error ? cause.message : 'Не удалось подготовить переход. Результаты останутся на сайте.');
    } finally {
      setBusy(false);
    }
  };

  if (!codeResult || !storyResult || !meetingResult) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setDialogOpen(true); setError(''); }}
        className="w-full sm:w-auto px-6 py-3.5 border border-white/15 text-stone-300 hover:text-white uppercase tracking-[0.18em] text-sm rounded-xs transition-colors inline-flex items-center justify-center gap-2"
      >
        <Send size={14} />
        <span>Продолжить в Telegram</span>
      </button>

      {status && (
        <div ref={statusRef} className="w-full" role="status" aria-live="polite">
          <p className="text-sm text-emerald-300">{status}</p>
          {telegramUrl && (
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-[#C8A45D] underline underline-offset-4">
              Открыть Telegram
            </a>
          )}
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-8" onMouseDown={event => {
          if (event.target === event.currentTarget && !busy) setDialogOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="telegram-continuation-title"
            className="w-full max-w-xl space-y-5 border border-[var(--color-border-gold)]/50 bg-[#0D121D] p-6 text-left text-stone-100 shadow-2xl sm:p-8"
          >
            <div className="flex items-center gap-3 text-[var(--color-antique-gold)]">
              <ShieldCheck size={20} />
              <h3 id="telegram-continuation-title" className="font-serif text-2xl">Продолжить исследование в Telegram?</h3>
            </div>
            <p className="text-base leading-relaxed text-stone-300">
              Альберт получит краткую сводку вашего Цифрового кода, Личного мифа, Встречи и открытого вопроса, а также ваши подтверждённые уточнения, если они есть. Дата рождения и исходные ответы Мифа в эту передачу не входят.
            </p>
            <p className="text-sm leading-relaxed text-stone-400">
              Перенос необязателен: можно остаться на сайте и продолжить диалог здесь. Ссылка Telegram одноразовая и действует 15 минут. Подробнее — в <a href="/privacy" target="_blank" rel="noreferrer" className="text-[var(--color-antique-gold)] underline underline-offset-4">условиях обработки данных</a>.
            </p>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone-200">
              <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} className="mt-1 size-5 shrink-0" />
              Я согласен передать эту краткую сводку Альберту в Telegram.
            </label>
            {error && <p role="alert" className="text-sm leading-relaxed text-amber-300">{error}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDialogOpen(false)} disabled={busy} className="min-h-11 px-5 text-sm text-stone-300 underline underline-offset-4 disabled:opacity-50">
                Остаться на сайте
              </button>
              <button type="button" onClick={createTransfer} disabled={!accepted || busy} className="min-h-11 rounded-xs bg-[var(--color-antique-gold)] px-5 text-sm font-semibold text-gray-950 disabled:opacity-40">
                {busy ? 'Готовим перенос…' : 'Согласиться и открыть Telegram'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
