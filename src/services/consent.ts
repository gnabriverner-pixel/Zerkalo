export const CONSENT_VERSION = 'zerkalo-2026-10-v2';
export const CONSENT_MAX_AGE_MS = 7 * 86400_000;
export type ConsentScope = 'core' | 'telegram_transfer';

export async function acceptConsent(scope: ConsentScope): Promise<void> {
  const response = await fetch('/api/consent', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({accepted:true, adult:true, version:CONSENT_VERSION, scope}),
  });
  if (!response.ok) throw new Error('consent_not_recorded');
}

const CONSENT_MARK_KEY = 'zerkalo.consent.mark';

/** Local reminder that the mark under the date was ticked (version + time). UI only: the server cookie stays the authority; no request is made to read it. */
export function rememberConsentMark(now: number = Date.now()): void {
  try { localStorage.setItem(CONSENT_MARK_KEY, JSON.stringify({ v: CONSENT_VERSION, t: now })); } catch { /* storage may be blocked */ }
}
export function forgetConsentMark(): void {
  try { localStorage.removeItem(CONSENT_MARK_KEY); } catch { /* ignore */ }
}
export function hasConsentMark(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_MARK_KEY);
    if (!raw) return false;
    const mark = JSON.parse(raw);
    return mark?.v === CONSENT_VERSION && typeof mark.t === 'number' && mark.t <= now && now - mark.t < CONSENT_MAX_AGE_MS;
  } catch { return false; }
}
