import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  access: { enabled: true, active: true, can_start_myth: true, pause_message: '' } as any,
}));
vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: (_t, tag: string) => (p: any) => { const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = p; return React.createElement(tag, rest); } }),
  AnimatePresence: ({ children }: any) => children,
}));
vi.mock('./ConsentBoundary', () => ({ useProtectedFetch: () => h.fetchMock }));
vi.mock('../services/freePreview', () => ({ useFreePreview: () => h.access, readFreePreview: async () => h.access }));
import PersonalMyth from './PersonalMyth';
import { MYTH_COPY, MYTH_TOTAL_WAIT_MS } from '../services/mythWait';

const ANSWERS = { q1: 'первый ответ', q2: 'второй ответ', q3: 'третий ответ', q4: 'четвёртый ответ' };
const STORY = { title: 'Готовая история', story: 'Текст', mirror: {}, meaning: [], one_step: '', journal_question: '', disclaimer: '' } as any;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const html504 = () => new Response('<html>504 Gateway Time-out</html>', { status: 504 });

let host: HTMLDivElement;
let root: Root;
const onMythCompleted = vi.fn();
const text = () => host.textContent || '';
const calls = (pred: (url: string, init?: any) => boolean) => h.fetchMock.mock.calls.filter(([u, i]) => pred(String(u), i));
const posts = () => calls((u, i) => u === '/api/personal-myth' && i?.method === 'POST');
const gets = () => calls((u, i) => u === '/api/stories' && i?.method === 'GET');
const button = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent?.includes(label));

async function flush(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function click(label: string) {
  const b = button(label);
  expect(b, `button "${label}"`).toBeDefined();
  await act(async () => { b!.click(); await vi.advanceTimersByTimeAsync(0); });
}
/** Opens the form with prefilled answers and presses "Создать Личный миф". */
async function start() {
  await act(async () => { root.render(React.createElement(PersonalMyth, { initialInputs: ANSWERS, onMythCompleted } as any)); });
  await click('Начать Личный миф');
  for (let i = 0; i < 3; i++) await click('Далее');
  await click('Создать Личный миф');
}
/** POST always lost (network error); account probe says "no account"; so waiting stops as unknown. */
function unknownRoutes(extra: (url: string, init: any) => Response | undefined = () => undefined) {
  h.fetchMock.mockImplementation(async (url: string, init: any) => {
    const r = extra(url, init);
    if (r) return r;
    if (url === '/api/personal-myth') throw new TypeError('Failed to fetch');
    if (url === '/api/stories') return json({ code: 'account_required' }, 401);
    if (url === '/api/stories/status') return json({ storage_accepted: false });
    throw new Error('unexpected ' + url);
  });
}
async function reachUnknown() { await start(); await flush(5_000); }

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any;
  Element.prototype.scrollIntoView = () => {};
  h.fetchMock.mockReset(); onMythCompleted.mockReset();
  h.access = { enabled: true, active: true, can_start_myth: true, pause_message: '' };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('PersonalMyth waiting copy', () => {
  it('shows the agreed lines at once and the elapsed line only after 20 s', async () => {
    h.fetchMock.mockImplementation(() => new Promise(() => {}));
    await start();
    expect(text()).toContain('Пишем ваш Личный миф.');
    expect(text()).toContain('Это может занять несколько минут.');
    expect(text()).not.toContain('Прошло');
    await flush(19_000);
    expect(text()).not.toContain('Прошло');
    await flush(1_000);
    expect(text()).toContain('Прошло 20 с. Обновлять страницу не нужно.');
    expect(text()).not.toContain('около минуты');
    expect(text()).not.toContain('сохранится');
  });

  it('unknown state, storage off: agreed lines, check button, no advice to press "Создать Личный миф"', async () => {
    unknownRoutes(); await reachUnknown();
    expect(text()).toContain('Пока не удалось получить историю. Проверить, появилась ли она?');
    expect(text()).toContain(MYTH_COPY.storageOff);
    expect(text()).not.toContain(MYTH_COPY.storageOn);
    expect(button('Проверить результат')).toBeDefined();
    expect(button('Создать историю заново')).toBeUndefined();
    expect(text()).not.toContain('нажмите «Создать Личный миф»');
    expect((button('Создать Личный миф') as HTMLButtonElement).disabled).toBe(true);
  });

  it('unknown state, storage on: only the "появится в сохранённых" line', async () => {
    unknownRoutes(u => u === '/api/stories/status' ? json({ storage_accepted: true }) : undefined); await reachUnknown();
    expect(text()).toContain('Если история будет готова, она появится в сохранённых.');
    expect(text()).not.toContain('Сохранение историй выключено');
  });

  it('after the whole wait window the state is unknown too (timeout)', async () => {
    h.fetchMock.mockImplementation(async (url: string) => url === '/api/personal-myth' ? json({ status: 'running' }, 202) : json({}));
    await start(); await flush(MYTH_TOTAL_WAIT_MS);
    expect(text()).toContain(MYTH_COPY.unknown);
    expect(button('Проверить результат')).toBeDefined();
  });
});

describe('«Проверить готовность»', () => {
  it('is one read-only GET per click and never a POST', async () => {
    unknownRoutes(); await reachUnknown();
    const postsBefore = posts().length;
    unknownRoutes(u => u === '/api/stories' ? json({ orders: [{ kind: 'free', state: 'generating', data: {} }] }) : undefined);
    const getsBefore = gets().length;
    await click('Проверить результат');
    expect(gets().length - getsBefore).toBe(1);
    await click('Проверить результат');
    expect(gets().length - getsBefore).toBe(2);
    expect(posts().length).toBe(postsBefore);
    expect(text()).toContain(MYTH_COPY.unknown); // still running: same honest text
  });

  it('shows the finished story when the saved order is ready for these answers', async () => {
    unknownRoutes(); await reachUnknown();
    unknownRoutes(u => u === '/api/stories' ? json({ orders: [{ kind: 'free', state: 'ready', data: { answers: ANSWERS, myth: STORY } }] }) : undefined);
    await click('Проверить результат');
    expect(onMythCompleted).toHaveBeenCalledWith(ANSWERS, STORY);
    expect(text()).toContain('Готовая история');
  });

  it('does not show another story that was issued for different answers', async () => {
    unknownRoutes(); await reachUnknown();
    unknownRoutes(u => u === '/api/stories' ? json({ orders: [{ kind: 'free', state: 'ready', data: { answers: { ...ANSWERS, q1: 'другое' }, myth: STORY } }] }) : undefined);
    await click('Проверить результат');
    expect(onMythCompleted).not.toHaveBeenCalled();
    expect(text()).toContain(MYTH_COPY.notFound);
  });

  it('expired temporary result: agreed message, no check and no new-generation button', async () => {
    unknownRoutes(); await reachUnknown();
    unknownRoutes(u => u === '/api/stories' ? json({ orders: [{ kind: 'free', state: 'ready', data: { messages: [], note: '' } }] }) : undefined);
    await click('Проверить результат');
    expect(text()).toContain('Время доступа к этой истории истекло.');
    expect(button('Проверить результат')).toBeUndefined();
    expect(button('Создать историю заново')).toBeUndefined();
  });

  it('nothing found (401): separate explicit NEW generation with a fresh request_id, sent once', async () => {
    unknownRoutes(); await reachUnknown();
    const firstId = JSON.parse(posts()[0][1].body).request_id;
    await click('Проверить результат');
    expect(text()).toContain(MYTH_COPY.notFound);
    const before = posts().length;
    unknownRoutes(u => u === '/api/personal-myth' ? new Promise(() => {}) as any : undefined);
    await click('Создать историю заново');
    expect(posts().length - before).toBe(1);
    const newId = JSON.parse(posts()[posts().length - 1][1].body).request_id;
    expect(newId).not.toBe(firstId);
  });

  it('server says the operation failed (202 failed): no automatic repeat, explicit new generation offered', async () => {
    h.fetchMock.mockImplementation(async (url: string) => url === '/api/personal-myth' ? json({ status: 'failed' }, 202) : json({}));
    await start();
    expect(posts().length).toBe(1);
    expect(text()).toContain(MYTH_COPY.failed);
    expect(button('Создать историю заново')).toBeDefined();
    expect(button('Проверить результат')).toBeUndefined();
  });
});

describe('legacy path (no idempotency)', () => {
  it('one attempt, no check button, no account probe, no re-send', async () => {
    h.access = { enabled: false, active: false, can_start_myth: true, pause_message: '' };
    h.fetchMock.mockImplementation(async () => html504());
    await start(); await flush(60_000);
    expect(posts().length).toBe(1);
    expect(gets().length).toBe(0);
    expect(button('Проверить результат')).toBeUndefined();
    expect(button('Создать историю заново')).toBeUndefined();
  });
});

describe('honest error box and free-story-ready intro', () => {
  const onOpenSavedStory = vi.fn();
  async function render() { await act(async () => { root.render(React.createElement(PersonalMyth, { initialInputs: ANSWERS, onMythCompleted, onOpenSavedStory } as any)); }); await flush(0); }
  async function fillAndSubmit() {
    await click('Начать Личный миф');
    for (let i = 0; i < 3; i++) await click('Далее');
    await click('Создать Личный миф');
    await flush(0);
  }
  const failWith = (code: string, ui: any) => h.fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/personal-myth') return json({ status: 'error', code, ui }, 409);
    if (url === '/api/stories') return json({ orders: [] });
    return json({});
  });
  beforeEach(() => onOpenSavedStory.mockReset());

  it('answers_locked: truthful text and "Открыть «Мои мифы»" instead of "Попробовать снова"', async () => {
    failWith('answers_locked', { safe_message: 'x', action: 'open_saved' });
    await render(); await fillAndSubmit();
    expect(text()).toContain('Бесплатная история в этом браузере уже создана — она в разделе «Мои мифы».');
    expect(button('Попробовать снова')).toBeUndefined();
    await click('Открыть «Мои мифы»');
    expect(onOpenSavedStory).toHaveBeenCalledTimes(1);
  });

  it('service_busy: repeat is offered', async () => {
    failWith('service_busy', { safe_message: 'Сейчас выполняются другие запросы.', action: 'retry' });
    await render(); await fillAndSubmit();
    expect(button('Попробовать снова')).toBeDefined();
    expect(button('Открыть «Мои мифы»')).toBeUndefined();
  });

  it('unknown code: support text and link, no blind retry', async () => {
    h.access = { ...h.access, support_url: 'https://t.me/synthetic_help' };
    failWith('some_new_code', { safe_message: 'Не получилось создать историю. Ваши ответы сохранены. Напишите в поддержку — мы увидим причину.', action: 'support' });
    await render(); await fillAndSubmit();
    expect(text()).toContain('Напишите в поддержку — мы увидим причину.');
    expect(button('Попробовать снова')).toBeUndefined();
    expect((host.querySelector('[data-testid="myth-support"]') as HTMLAnchorElement).href).toBe('https://t.me/synthetic_help');
  });

  it('action none: neither retry nor open button', async () => {
    failWith('recovery_invalid', { safe_message: 'Код восстановления не найден.', action: 'none' });
    await render(); await fillAndSubmit();
    expect(text()).toContain('Код восстановления не найден.');
    expect(button('Попробовать снова')).toBeUndefined();
  });

  it('the note under the button no longer says "Попытка одна"', async () => {
    h.fetchMock.mockImplementation(async () => json({ orders: [] }));
    await render(); await click('Начать Личный миф'); for (let i = 0; i < 3; i++) await click('Далее');
    expect(text()).toContain('Одна бесплатная история на этот браузер.');
    expect(text()).not.toContain('Попытка одна');
  });

  it('a ready free story: the intro shows "Мои мифы" instead of the start button', async () => {
    h.fetchMock.mockImplementation(async (url: string) => url === '/api/stories' ? json({ orders: [{ kind: 'free', state: 'ready' }] }) : json({}));
    await render();
    expect(text()).toContain('Ваша бесплатная история уже готова — «Мои мифы».');
    expect(button('Начать Личный миф')).toBeUndefined();
    await click('Открыть «Мои мифы»');
    expect(onOpenSavedStory).toHaveBeenCalledTimes(1);
  });

  it('owner service mode keeps the form even with a ready free story', async () => {
    h.fetchMock.mockImplementation(async (url: string) => url === '/api/stories' ? json({ orders: [{ kind: 'free', state: 'ready' }], owner_test: true }) : json({}));
    await render();
    expect(button('Начать Личный миф')).toBeDefined();
  });

  it('no account (401): the form is shown', async () => {
    h.fetchMock.mockImplementation(async (url: string) => url === '/api/stories' ? json({ code: 'account_required' }, 401) : json({}));
    await render();
    expect(button('Начать Личный миф')).toBeDefined();
  });
});
