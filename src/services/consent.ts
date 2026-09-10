export const CONSENT_VERSION = 'zerkalo-2026-09-v1';
export const CONSENT_MAX_AGE_MS = 7 * 86400_000;
export type ConsentScope = 'core' | 'telegram_transfer';

export async function acceptConsent(scope: ConsentScope): Promise<void> {
  const response = await fetch('/api/consent', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({accepted:true, adult:true, version:CONSENT_VERSION, scope}),
  });
  if (!response.ok) throw new Error('consent_not_recorded');
}
