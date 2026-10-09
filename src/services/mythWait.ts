import type { ApiResponse } from '../types';

// Long Myth generation: while the server keeps working, the client re-sends the SAME request_id.
export const MYTH_POLL_INTERVAL_MS = 5_000;
export const MYTH_TOTAL_WAIT_MS = 4 * 60_000;
export const MYTH_SLOW_HINT_MS = 20_000;

/** Server codes meaning "this operation is already running" (server/commerceStore.ts reserve()). */
const IN_PROGRESS_CODES = new Set(['operation_in_progress', 'myth_not_available']);
const IN_PROGRESS_STATUSES = new Set(['running', 'uncertain']);
const GATEWAY_STATUSES = new Set([502, 503, 504]);

export type MythWaitResult =
  | { kind: 'data'; data: ApiResponse }
  | { kind: 'declined' }
  | { kind: 'timeout' }
  | { kind: 'aborted' };

type Parsed = { pending: true } | { pending: false; data: ApiResponse };

async function parse(res: Response, retry: boolean): Promise<Parsed> {
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch {
    // Non-JSON reply (e.g. an nginx 504 HTML page): the server may still be generating.
    if (retry && GATEWAY_STATUSES.has(res.status)) return { pending: true };
    throw new Error('Non-JSON reply');
  }
  if (!retry) return { pending: false, data };
  if (res.status === 202 && IN_PROGRESS_STATUSES.has(data?.status)) return { pending: true };
  if (IN_PROGRESS_STATUSES.has(data?.status) && !data?.story_result) return { pending: true };
  if (data?.status === 'error' && IN_PROGRESS_CODES.has(data?.code)) return { pending: true };
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
  intervalMs?: number;
  totalMs?: number;
}): Promise<MythWaitResult> {
  const { send, retry, signal, intervalMs = MYTH_POLL_INTERVAL_MS, totalMs = MYTH_TOTAL_WAIT_MS } = opts;
  const started = Date.now();
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
      parsed = { pending: true };
    }
    if (parsed.pending === false) return { kind: 'data', data: parsed.data };
    if (Date.now() - started + intervalMs >= totalMs) return { kind: 'timeout' };
    await pause(intervalMs, signal);
    if (signal.aborted) return { kind: 'aborted' };
  }
}
