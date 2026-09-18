import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('probeDcsBridge', () => {
  let probeDcsBridge: typeof import('./dcsBridge').probeDcsBridge;

  beforeEach(async () => {
    vi.resetModules();
    ({ probeDcsBridge } = await import('./dcsBridge'));
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports ready with the DCS-reported sha', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sha: 'fe67002ce2a2f9d05fa9faf205ef45264f05a931' }) });
    const result = await probeDcsBridge();
    expect(result).toEqual({ state: 'ready', sha: 'fe67002ce2a2f9d05fa9faf205ef45264f05a931' });
  });

  it('reports unknown sha when the bridge omits it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const result = await probeDcsBridge();
    expect(result).toEqual({ state: 'ready', sha: 'unknown' });
  });

  it('reports unavailable on non-ok status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const result = await probeDcsBridge();
    expect(result).toEqual({ state: 'unavailable', sha: 'unknown' });
  });

  it('reports unavailable on connection failure', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { name: 'TypeError' }));
    const result = await probeDcsBridge();
    expect(result).toEqual({ state: 'unavailable', sha: 'unknown' });
  });

  it('reports timeout when the probe exceeds its deadline', async () => {
    fetchMock.mockImplementation((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })
    );
    const result = await probeDcsBridge(20);
    expect(result).toEqual({ state: 'timeout', sha: 'unknown' });
  });

  it('caches the probe result briefly so polling cannot hammer the bridge', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sha: 'abc123' }) });
    await probeDcsBridge();
    await probeDcsBridge();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
