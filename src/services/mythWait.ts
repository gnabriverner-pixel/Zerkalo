import type { ApiResponse } from '../types';

// Long Myth generation: while the server keeps working, the client re-sends the SAME request_id.
export const MYTH_POLL_INTERVAL_MS = 5_000;
export const MYTH_TOTAL_WAIT_MS = 4 * 60_000;
export const MYTH_SLOW_HINT_MS = 20_000;

/** Server codes meaning "this operation is already running" (server/commerceStore.ts reserve()). */
const IN_PROGRESS_CODES = new Set(['operation_in_progress', 'myth_not_available']);
const IN_PROGRESS_STATUSES = new Set(['running', 'uncertain']);
const GATEWAY_STATUSES = new Set([502, 503, 504]);

// User-facing copy (owner-approved wording, ASTRA-PASS2-PREFLIGHT-AND-WAITING-COPY section 3).
export const MYTH_COPY = {
  writing: 'Пишем вашу историю.',
  mayTakeMinutes: 'Это может занять несколько минут.',
  elapsed: (sec: number) => `Прошло ${sec} с. Обновлять страницу не нужно.`,
  unknown: 'Пока не удалось получить историю. Проверить, появилась ли она?',
  // Honest wording for an unconfirmed result (no promise of recovery); the support link is shown only when the preview provides one.
  unconfirmed: 'Результат не подтверждён. Если история не появится, обратитесь в поддержку.',
  supportLink: 'Написать в поддержку',
  check: 'Проверить результат',
  storageOn: 'Если история будет готова, она появится в сохранённых.',
  storageOff: 'Сохранение историй выключено. Готовый результат доступен временно; не закрывайте страницу, пока мы проверяем готовность.',
  expired: 'Время доступа к этой истории истекло.',
  // Not in the owner's spec: needs content review.
  checking: 'Проверяем…',
  notFound: 'Мы не нашли запущенной истории по этому запросу.',
  failed: 'Историю создать не удалось.',
  newGeneration: 'Создать историю заново',
  // New stories cannot be started now (server says so). No date is promised: none is known.
  unavailable: 'Сейчас создать новую историю нельзя.',
  unavailableWithExample: 'Сейчас создать новую историю нельзя. Можно прочитать пример или открыть свои сохранённые истории.',
  unavailableNoExample: 'Сейчас создать новую историю нельзя. Можно открыть свои сохранённые истории.',
  afterStory: 'Что в ней отозвалось?',
  albertIntro: 'Собеседник: можно сказать, что тронуло, что не похоже на вас или осталось непонятным.',
} as const;

export type MythWaitResult =
  | { kind: 'data'; data: ApiResponse }
  | { kind: 'declined' }
  | { kind: 'timeout' }
  // Re-sending was refused because the browser holds no story account: a re-POST could start a SECOND generation.
  | { kind: 'unsafe' }
  | { kind: 'aborted' };

type Parsed = { pending: true; replied: boolean } | { pending: false; data: ApiResponse };

async function parse(res: Response, retry: boolean): Promise<Parsed> {
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch {
    // Non-JSON reply (e.g. an nginx 504 HTML page): the server may still be generating.
    if (retry && GATEWAY_STATUSES.has(res.status)) return { pending: true, replied: false };
    throw new Error('Non-JSON reply');
  }
  if (!retry) return { pending: false, data };
  if (res.status === 202 && IN_PROGRESS_STATUSES.has(data?.status)) return { pending: true, replied: true };
  if (IN_PROGRESS_STATUSES.has(data?.status) && !data?.story_result) return { pending: true, replied: true };
  if (data?.status === 'error' && IN_PROGRESS_CODES.has(data?.code)) return { pending: true, replied: true };
  return { pending: false, data };
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    if (signal.aborted) return resolve();
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });
}

/**
 * `send` must POST the same body/request_id every time. `retry` is true only when the server is known
 * to replay by request_id (story path); otherwise a single attempt is made, as before.
 */
export async function waitForMyth(opts: {
  send: () => Promise<Response | null>;
  retry: boolean;
  signal: AbortSignal;
  /**
   * Called before a re-send while the server has not yet answered with JSON. The session cookie is httpOnly, so
   * if the first reply was lost the browser may hold no account, and a re-POST would then create a new account and
   * a new generation. Return false to stop instead of re-sending.
   */
  canResend?: () => Promise<boolean>;
  intervalMs?: number;
  totalMs?: number;
}): Promise<MythWaitResult> {
  const { send, retry, signal, canResend, intervalMs = MYTH_POLL_INTERVAL_MS, totalMs = MYTH_TOTAL_WAIT_MS } = opts;
  const started = Date.now();
  let replied = false;
  for (;;) {
    let parsed: Parsed;
    try {
      const res = await send();
      if (signal.aborted) return { kind: 'aborted' };
      if (!res) return { kind: 'declined' };
      parsed = await parse(res, retry);
    } catch (err) {
      if (signal.aborted) return { kind: 'aborted' };
      // fetch() network failure (TypeError): the request may have reached the server; re-sending is idempotent.
      if (!(retry && err instanceof TypeError)) throw err;
      parsed = { pending: true, replied: false };
    }
    if (parsed.pending === false) return { kind: 'data', data: parsed.data };
    if (parsed.replied) replied = true;
    if (Date.now() - started + intervalMs >= totalMs) return { kind: 'timeout' };
    await pause(intervalMs, signal);
    if (signal.aborted) return { kind: 'aborted' };
    if (!replied && canResend) {
      const allowed = await canResend().catch(() => false);
      if (signal.aborted) return { kind: 'aborted' };
      if (!allowed) return { kind: 'unsafe' };
    }
  }
}

export type MythReadiness =
  | { kind: 'ready'; story: NonNullable<ApiResponse['story_result']> }
  | { kind: 'running' } | { kind: 'failed' } | { kind: 'expired' } | { kind: 'notFound' } | { kind: 'unavailable' };

const same = (a: unknown, b: unknown) => String(a ?? '').replace(/\s+/g, ' ').trim() === String(b ?? '').replace(/\s+/g, ' ').trim();

/**
 * "Проверить готовность": a READ-ONLY GET of the account's story list (server/storyCommerce.ts GET /api/stories).
 * It never POSTs, never creates an account and cannot start a model call. A re-POST of the same request_id is NOT
 * used here because with a lost cookie or an unreceived first request it would be a (new) generation.
 */
export async function checkMythReadiness(get: (url: string, init: RequestInit) => Promise<Response | null>, answers: object): Promise<MythReadiness> {
  try {
    const res = await get('/api/stories', { method: 'GET', cache: 'no-store' });
    if (!res) return { kind: 'unavailable' };
    if (res.status === 401) return { kind: 'notFound' }; // account_required: no account behind this browser
    if (!res.ok) return { kind: 'unavailable' };
    const free = ((await res.json())?.orders as any[] | undefined)?.find(o => o?.kind === 'free');
    if (!free) return { kind: 'notFound' };
    if (free.data?.myth) {
      const saved = free.data.answers;
      return saved && ['q1', 'q2', 'q3', 'q4'].every(k => same(saved[k], (answers as any)[k]))
        ? { kind: 'ready', story: free.data.myth } : { kind: 'notFound' };
    }
    if (free.state === 'ready') return { kind: 'expired' }; // payload wiped after payload_expires (commerceStore.ts order())
    if (free.state === 'generating') return { kind: 'running' };
    if (free.state === 'generation_failed') return { kind: 'failed' };
    return { kind: 'notFound' };
  } catch { return { kind: 'unavailable' }; }
}

/** True only when the account has accepted storage (GET /api/stories/status): then the library lists the story. */
export async function readStorageAccepted(get: (url: string, init: RequestInit) => Promise<Response | null>): Promise<boolean> {
  try {
    const res = await get('/api/stories/status', { method: 'GET', cache: 'no-store' });
    return Boolean(res?.ok && (await res.json())?.storage_accepted === true);
  } catch { return false; }
}

/** Account probe for canResend: 200 means this browser holds a story account (cookie) to re-send under. */
export async function hasStoryAccount(get: (url: string, init: RequestInit) => Promise<Response | null>): Promise<boolean> {
  try { return Boolean((await get('/api/stories', { method: 'GET', cache: 'no-store' }))?.ok); } catch { return false; }
}
