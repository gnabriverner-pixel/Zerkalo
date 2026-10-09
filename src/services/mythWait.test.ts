import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForMyth, MYTH_POLL_INTERVAL_MS, MYTH_TOTAL_WAIT_MS } from './mythWait';

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
