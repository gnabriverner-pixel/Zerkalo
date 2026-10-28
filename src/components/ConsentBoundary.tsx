import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { acceptConsent, rememberConsentMark, forgetConsentMark, hasConsentMark } from '../services/consent';

export const CONSENT_MISSING = 'consent_missing';
type ProtectedFetchOptions = { /** Never open the consent dialog: throw CONSENT_MISSING instead (used on the date path, where the mark under the date is the consent). */ noDialog?: boolean };
type ProtectedFetch = (input: string, init: RequestInit, options?: ProtectedFetchOptions) => Promise<Response | null>;
type InlineConsent = {
  accepted: boolean;
  /** True when `accepted` comes only from the local reminder (after a reload): the server cookie is checked once on click via verify(). */
  restored: boolean;
  accept: () => Promise<void>;
  /** Asks the server whether the consent cookie is still valid. On "no" the local reminder is dropped and the mark shows again. */
  verify: () => Promise<boolean>;
  revoke: () => void;
};
type ConsentAccess = { protectedFetch: ProtectedFetch; ensureCoreConsent: () => Promise<boolean>; inline: InlineConsent };
const ConsentContext = createContext<ConsentAccess | null>(null);

export function useProtectedFetch(): ProtectedFetch {
  const value = useContext(ConsentContext);
  return value?.protectedFetch || (async () => { throw new Error('ConsentBoundary is required for protected requests'); });
}

/**
 * Inline consent at the moment of date entry: the form shows one checkbox and calls accept()
 * only after it is ticked. `accepted` reflects a valid consent cookie of the current version.
 */
export function useInlineConsent(): InlineConsent {
  const value = useContext(ConsentContext);
  return value?.inline || { accepted: false, restored: false, verify: async () => false, revoke: () => {}, accept: async () => { throw new Error('ConsentBoundary is required for protected requests'); } };
}

export function useCoreConsent(): () => Promise<boolean> {
  const value = useContext(ConsentContext);
  return value?.ensureCoreConsent || (async () => { throw new Error('ConsentBoundary is required for protected requests'); });
}

/** The page remains visible; only a deliberate protected request can open this dialog. */
export function ConsentBoundary({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inlineAccepted, setInlineAccepted] = useState<boolean>(() => hasConsentMark());
  const [restored, setRestored] = useState<boolean>(() => hasConsentMark());
  const confirmedAt = useRef(0);
  const pending = useRef<Promise<boolean> | null>(null);
  const resolvePending = useRef<((accepted: boolean) => void) | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback((accepted: boolean) => {
    resolvePending.current?.(accepted);
    resolvePending.current = null;
    pending.current = null;
    setOpen(false);
    setChecked(false);
    setError('');
    const focusTarget = previousFocus.current;
    previousFocus.current = null;
    queueMicrotask(() => focusTarget?.focus());
  }, []);

  const requestConsent = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current;
    previousFocus.current = document.activeElement as HTMLElement | null;
    setChecked(false);
    setError('');
    setOpen(true);
    pending.current = new Promise<boolean>(resolve => { resolvePending.current = resolve; });
    return pending.current;
  }, []);

  useEffect(() => {
    if (!open) return;
    checkboxRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); close(false); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, close]);

  const markAccepted = useCallback(() => {
    confirmedAt.current = Date.now();
    rememberConsentMark();
    setRestored(false);
    setInlineAccepted(true);
  }, []);

  const checkServerConsent = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/consent', { cache: 'no-store' });
      return response.ok && (await response.json()).accepted === true;
    } catch {
      return false; // A failed check never authorizes a personal-data request.
    }
  }, []);

  const inline = React.useMemo<InlineConsent>(() => ({
    accepted: inlineAccepted,
    restored,
    accept: async () => { await acceptConsent('core'); markAccepted(); },
    verify: async () => {
      if (await checkServerConsent()) { confirmedAt.current = Date.now(); setRestored(false); return true; }
      forgetConsentMark(); setInlineAccepted(false); setRestored(false);
      return false;
    },
    revoke: () => { forgetConsentMark(); confirmedAt.current = 0; setInlineAccepted(false); setRestored(false); },
  }), [inlineAccepted, restored, markAccepted, checkServerConsent]);

  const ensureCoreConsent = useCallback(async (): Promise<boolean> => {
    // Just confirmed by the user's own click (mark or dialog) or verified a moment ago: do not ask again.
    if (confirmedAt.current && Date.now() - confirmedAt.current < 10 * 60_000) return true;
    let accepted = false;
    try {
      const response = await fetch('/api/consent', { cache: 'no-store' });
      if (response.ok) accepted = (await response.json()).accepted === true;
    } catch {
      // A failed check never authorizes a personal-data request.
    }
    return accepted || requestConsent();
  }, [requestConsent]);

  const checkOrRecent = useCallback(async (): Promise<boolean> => {
    if (confirmedAt.current && Date.now() - confirmedAt.current < 10 * 60_000) return true;
    return checkServerConsent();
  }, [checkServerConsent]);

  const protectedFetch = useCallback<ProtectedFetch>(async (input, init, options) => {
    if (init.signal?.aborted) return null;
    if (options?.noDialog) {
      if (!(await checkOrRecent())) throw new Error(CONSENT_MISSING);
    } else if (!(await ensureCoreConsent())) return null;
    if (init.signal?.aborted) return null;

    let response = await fetch(input, init);
    if (response.status === 403) {
      const body = await response.clone().json().catch(() => ({}));
      if (body?.code === 'consent_required') {
        if (options?.noDialog) throw new Error(CONSENT_MISSING);
        if (!(await requestConsent()) || init.signal?.aborted) return null;
        response = await fetch(input, init);
      }
    }
    return response;
  }, [ensureCoreConsent, requestConsent, checkOrRecent]);

  const confirm = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError('');
    try {
      await acceptConsent('core');
      markAccepted();
      close(true);
    } catch {
      setError('Согласие не сохранено. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return <ConsentContext.Provider value={{ protectedFetch, ensureCoreConsent, inline }}>
    {children}
    {open && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-5 py-8 overflow-y-auto" onMouseDown={event => { if (event.target === event.currentTarget && !busy) close(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="consent-heading" className="max-w-xl w-full max-h-full overflow-y-auto space-y-5 rounded-2xl border border-white/15 bg-[#090D15] p-6 sm:p-8 text-stone-100 shadow-2xl">
        <p className="text-sm text-[#C8A45D]">Зеркало себя · Перед первым зеркалом</p>
        <h2 id="consent-heading" className="font-serif text-3xl leading-tight">Ваш опыт остаётся вашим</h2>
        <p className="text-base leading-relaxed text-stone-300">Код использует дату рождения для расчёта. Миф и Альберт передают ваши ответы AI-провайдеру для создания текста. Не указывайте чужие личные данные. Это пространство самоисследования, не диагностика.</p>
        <p className="text-base leading-relaxed text-stone-300">Сохранение в браузере — по вашему выбору. Перенос контекста в Telegram потребует отдельного согласия. Автоматические сообщения этим согласием не включаются.</p>
        <nav className="flex flex-wrap gap-5 text-[#C8A45D]"><a href="/privacy" target="_blank" rel="noreferrer" className="underline py-2">Обработка данных</a><a href="/terms" target="_blank" rel="noreferrer" className="underline py-2">Условия использования</a></nav>
        <label className="flex items-start gap-3 min-h-11 cursor-pointer text-base leading-relaxed"><input ref={checkboxRef} type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} className="mt-1 size-5 shrink-0"/>Мне исполнилось 18 лет. Я прочитал(а) условия и согласен(на) на описанную обработку данных для работы зеркал и диалога.</label>
        {error && <p role="alert" className="text-amber-300">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!checked || busy} className="min-h-12 px-6 py-3 bg-[#C8A45D] text-gray-950 disabled:opacity-40 rounded-sm" onClick={confirm}>{busy ? 'Сохраняем согласие…' : 'Согласиться и продолжить'}</button>
          <button type="button" disabled={busy} className="min-h-12 px-6 py-3 border border-white/25 rounded-sm disabled:opacity-40" onClick={() => close(false)}>Сейчас не хочу</button>
        </div>
      </section>
    </div>}
  </ConsentContext.Provider>;
}
