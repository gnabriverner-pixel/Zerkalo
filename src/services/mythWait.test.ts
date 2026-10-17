import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MYTH_ERROR_COPY, MYTH_OPEN_SAVED_LABEL, waitForMyth, checkMythReadiness, readStorageAccepted, hasStoryAccount, MYTH_COPY, MYTH_POLL_INTERVAL_MS, MYTH_TOTAL_WAIT_MS } from './mythWait';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const html504 = () => new Response('<html><body>504 Gateway Time-out</body></html>', { status: 504, headers: { 'Content-Type': 'text/html' } });
const story = { status: 'ok', story_result: { title: 'T' } } as any;

function run(replies: Array<() => Response | null | Promise<Response | null>>, retry = true, signal = new AbortController().signal) {
  let i = 0;
  const send = vi.fn(async () => replies[Math.min(i++, replies.length - 1)]());
  return { send, promise: waitForMyth({ send, retry, signal }) };
}

describe('waitForMyth (long Myth generation)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('202 running, then the finished story: one wait, same send twice', async () => {
    const { send, promise } = run([() => json({ status: 'running' }, 202), () => json(story)]);
    await vi.advanceTimersByTimeAsync(MYTH_POLL_INTERVAL_MS);
    expect(await promise).toEqual({ kind: 'data', data: story });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('504 HTML page, then the finished story', async () => {
    const { send, promise } = run([html504, () => json(story)]);
    await vi.advanceTimersByTimeAsync(MYTH_POLL_INTERVAL_MS);
    expect((await promise).kind).toBe('data');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('network error (TypeError), then the story', async () => {
    const { promise } = run([() => { throw new TypeError('Failed to fetch'); }, () => json(story)]);
    await vi.advanceTimersByTimeAsync(MYTH_POLL_INTERVAL_MS);
    expect((await promise).kind).toBe('data');
  });

  it('server "already running" codes are in progress', async () => {
    for (const code of ['operation_in_progress', 'myth_not_available']) {
      const { send, promise } = run([() => json({ status: 'error', code, ui: { safe_message: 'x' } }, 409), () => json(story)]);
      await vi.advanceTimersByTimeAsync(MYTH_POLL_INTERVAL_MS);
      expect((await promise).kind).toBe('data');
      expect(send).toHaveBeenCalledTimes(2);
    }
  });

  it('a JSON error with another code stays final and is not re-sent', async () => {
    const err = { status: 'error', code: 'service_busy', ui: { safe_message: 'Занято' } };
    const { send, promise } = run([() => json(err, 503)]);
    expect(await promise).toEqual({ kind: 'data', data: err });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a 202 with a final status (failed) is not polled', async () => {
    const { send, promise } = run([() => json({ status: 'failed' }, 202)]);
    expect((await promise).kind).toBe('data');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('gives up at the total limit and reports timeout', async () => {
    const { send, promise } = run([html504]);
    await vi.advanceTimersByTimeAsync(MYTH_TOTAL_WAIT_MS + MYTH_POLL_INTERVAL_MS);
    expect(await promise).toEqual({ kind: 'timeout' });
    expect(send.mock.calls.length).toBeLessThanOrEqual(MYTH_TOTAL_WAIT_MS / MYTH_POLL_INTERVAL_MS + 1);
    const calls = send.mock.calls.length;
    await vi.advanceTimersByTimeAsync(MYTH_TOTAL_WAIT_MS);
    expect(send).toHaveBeenCalledTimes(calls);
  });

  it('legacy path (retry=false): single attempt, today\'s behaviour', async () => {
    const running = run([() => json({ status: 'running' }, 202)], false);
    expect(await running.promise).toEqual({ kind: 'data', data: { status: 'running' } });
    expect(running.send).toHaveBeenCalledTimes(1);
    const gateway = run([html504], false);
    await expect(gateway.promise).rejects.toThrow();
    expect(gateway.send).toHaveBeenCalledTimes(1);
    const net = run([() => { throw new TypeError('Failed to fetch'); }], false);
    await expect(net.promise).rejects.toBeInstanceOf(TypeError);
    expect(net.send).toHaveBeenCalledTimes(1);
  });

  it('stops re-sending after abort (unmount)', async () => {
    const controller = new AbortController();
    const { send, promise } = run([html504], true, controller.signal);
    await vi.advanceTimersByTimeAsync(MYTH_POLL_INTERVAL_MS);
    controller.abort();
    expect(await promise).toEqual({ kind: 'aborted' });
    const calls = send.mock.calls.length;
    await vi.advanceTimersByTimeAsync(MYTH_TOTAL_WAIT_MS);
    expect(send).toHaveBeenCalledTimes(calls);
  });

  it('declined consent (null response) ends without retry', async () => {
    const { send, promise } = run([() => null]);
    expect(await promise).toEqual({ kind: 'declined' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('re-send guard when the first reply was lost', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('stops with "unsafe" and sends nothing more when no story account is held', async () => {
    const send = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const canResend = vi.fn(async () => false);
    const promise = waitForMyth({ send, retry: true, signal: new AbortController().signal, canResend });
    await vi.advanceTimersByTimeAsync(MYTH_POLL_INTERVAL_MS);
    expect(await promise).toEqual({ kind: 'unsafe' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(canResend).toHaveBeenCalledTimes(1);
  });

  it('re-sends when the account exists, and does not probe once the server has answered with JSON', async () => {
    const canResend = vi.fn(async () => true);
    const replies = [() => html504(), () => json({ status: 'running' }, 202), () => json({ status: 'running' }, 202), () => json(story)];
    let i = 0;
    const send = vi.fn(async () => replies[i++]());
    const promise = waitForMyth({ send, retry: true, signal: new AbortController().signal, canResend });
    await vi.advanceTimersByTimeAsync(MYTH_POLL_INTERVAL_MS * 3);
    expect((await promise).kind).toBe('data');
    expect(send).toHaveBeenCalledTimes(4);
    expect(canResend).toHaveBeenCalledTimes(1); // only before the 2nd send; the 202 JSON proves the cookie is held
  });
});

describe('checkMythReadiness (read-only GET /api/stories)', () => {
  const A = { q1: 'a b', q2: 'c', q3: 'd', q4: 'e' };
  const get = (res: Response | null) => vi.fn(async () => res);
  const orders = (o: any) => json({ orders: [o] });

  it('only ever issues GET', async () => {
    const g = get(orders({ kind: 'free', state: 'generating', data: {} }));
    await checkMythReadiness(g, A);
    expect(g).toHaveBeenCalledTimes(1);
    expect(g.mock.calls[0]).toEqual(['/api/stories', { method: 'GET', cache: 'no-store' }]);
  });
  it('maps every server state', async () => {
    expect((await checkMythReadiness(get(orders({ kind: 'free', state: 'ready', data: { answers: { ...A, q1: 'a  b ' }, myth: { title: 'T' } } })), A)).kind).toBe('ready');
    expect((await checkMythReadiness(get(orders({ kind: 'free', state: 'ready', data: { answers: { ...A, q2: 'x' }, myth: { title: 'T' } } })), A)).kind).toBe('notFound');
    expect((await checkMythReadiness(get(orders({ kind: 'free', state: 'ready', data: { messages: [], note: '' } })), A)).kind).toBe('expired');
    expect((await checkMythReadiness(get(orders({ kind: 'free', state: 'generating', data: {} })), A)).kind).toBe('running');
    expect((await checkMythReadiness(get(orders({ kind: 'free', state: 'generation_failed', data: {} })), A)).kind).toBe('failed');
    expect((await checkMythReadiness(get(orders({ kind: 'free', state: 'answers_saved', data: {} })), A)).kind).toBe('notFound');
    expect((await checkMythReadiness(get(json({ orders: [] })), A)).kind).toBe('notFound');
    expect((await checkMythReadiness(get(json({ code: 'account_required' }, 401)), A)).kind).toBe('notFound');
    expect((await checkMythReadiness(get(json({}, 500)), A)).kind).toBe('unavailable');
    expect((await checkMythReadiness(get(null), A)).kind).toBe('unavailable');
    expect((await checkMythReadiness(vi.fn(async () => { throw new TypeError('x'); }), A)).kind).toBe('unavailable');
  });
  it('storage and account probes default to false', async () => {
    expect(await readStorageAccepted(get(json({ storage_accepted: true })))).toBe(true);
    expect(await readStorageAccepted(get(json({ storage_accepted: false })))).toBe(false);
    expect(await readStorageAccepted(get(json({}, 500)))).toBe(false);
    expect(await hasStoryAccount(get(json({ orders: [] })))).toBe(true);
    expect(await hasStoryAccount(get(json({}, 401)))).toBe(false);
  });
  it('agreed wording is verbatim', () => {
    expect(MYTH_COPY.writing).toBe('Пишем ваш Личный миф.');
    expect(MYTH_COPY.mayTakeMinutes).toBe('Это может занять несколько минут.');
    expect(MYTH_COPY.elapsed(20)).toBe('Прошло 20 с. Обновлять страницу не нужно.');
    expect(MYTH_COPY.unknown).toBe('Пока не удалось получить историю. Проверить, появилась ли она?');
    expect(MYTH_COPY.check).toBe('Проверить результат');
    expect(MYTH_COPY.storageOn).toBe('Если история будет готова, она появится в сохранённых.');
    expect(MYTH_COPY.storageOff).toBe('Сохранение историй выключено. Готовый результат доступен временно; не закрывайте страницу, пока мы проверяем готовность.');
    expect(MYTH_COPY.expired).toBe('Время доступа к этой истории истекло.');
  });
});

describe('13.1 code-specific refusal copy', () => {
  it('has calm texts for known codes and none for the unknown ones (they keep the general text)', () => {
    expect(MYTH_ERROR_COPY.free_story_already_issued).toBe('Ваш бесплатный Личный миф уже создан.');
    expect(MYTH_ERROR_COPY.free_budget_exhausted).toBeTruthy();
    expect(MYTH_ERROR_COPY.service_busy).toBeTruthy();
    expect(MYTH_ERROR_COPY.saved_answers_differ).toBeUndefined();
    expect(MYTH_OPEN_SAVED_LABEL).toBe('Открыть в «Моих мифах»');
  });
});
