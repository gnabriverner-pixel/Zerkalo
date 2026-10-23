import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  config: { writer: 'v2a', generation_available: true, example_url: null } as any,
  access: { enabled: true, active: true, can_start_myth: true, pause_message: '' } as any,
}));
vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: (_t, tag: string) => (p: any) => { const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = p; return React.createElement(tag, rest); } }),
  AnimatePresence: ({ children }: any) => children,
}));
vi.mock('./ConsentBoundary', () => ({ useProtectedFetch: () => h.fetchMock }));
vi.mock('../services/freePreview', () => ({ useFreePreview: () => h.access, readFreePreview: async () => h.access }));
vi.mock('../services/mythAvailability', () => ({ useMythConfig: () => h.config }));
import PersonalMyth from './PersonalMyth';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const V2A_RESULT = {
  title: 'Лампа в доме хранителя', story: 'Первый абзац.\n\nВторой абзац.', mirror: { mainImage: '', innerTension: '', hiddenResource: '', newView: '' },
  meaning: ['Возможно, это про выбор.', 'Посмотрите, похоже ли.'], one_step: 'Семь дней по одному шагу. Как поймёте, что получилось: станет тише.',
  journal_question: 'Что вы сделаете первым?', disclaimer: 'x',
  made_of: [{ element: 'Лампа', source: 'слово «устал» из первого ответа' }, { element: 'Колодец', source: 'второй ответ' }, { element: 'Мост', source: 'третий ответ' },
    { element: 'Ключ', source: 'третий ответ' }, { element: 'Сад', source: 'первый ответ' }],
};
const OLD_V41 = { title: 'Старая сказка', story: 'Старый текст.', mirror: { mainImage: '', innerTension: '', hiddenResource: '', newView: '' }, meaning: [], one_step: '', journal_question: '', disclaimer: '' };
const OLD_V15 = { title: 'Совсем старая', story: 'Давний текст.', mirror: { mainImage: 'Образ M', innerTension: 'Напряжение I', hiddenResource: 'Ресурс H', newView: 'Взгляд N' },
  meaning: ['смысл'], one_step: 'Шаг', journal_question: 'Старый вопрос?', disclaimer: 'x' };

let host: HTMLDivElement;
let root: Root;
const text = () => host.textContent || '';
const button = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent?.includes(label));
async function flush(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function click(label: string) {
  const b = button(label);
  expect(b, `button "${label}"`).toBeDefined();
  await act(async () => { b!.click(); await vi.advanceTimersByTimeAsync(0); });
}
async function typeInto(value: string) {
  const area = host.querySelector('textarea') as HTMLTextAreaElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(area, value); area.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const render = async (props: any = {}) => { await act(async () => { root.render(React.createElement(PersonalMyth, props)); }); };

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any;
  Element.prototype.scrollIntoView = () => {};
  h.fetchMock.mockReset();
  h.config = { writer: 'v2a', generation_available: true, example_url: null };
  h.access = { enabled: true, active: true, can_start_myth: true, pause_message: '' };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('questionnaire of writer v2a', () => {
  it('asks exactly three questions in the contract wording and sends q1, q3, q4 with q2 empty', async () => {
    h.fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/personal-myth') return json({ status: 'ok', story_result: V2A_RESULT });
      throw new Error('unexpected ' + url);
    });
    await render();
    expect(text()).toContain('Три вопроса');
    await click('Начать Личный миф');
    expect(text()).toContain('01 / 03');
    expect(text()).toContain('Что сейчас происходит?');
    await typeInto('Устал на работе'); await click('Далее');
    expect(text()).toContain('02 / 03');
    expect(text()).toContain('Где вы недавно были на своём месте?');
    await typeInto('не помню'); await click('Далее');
    expect(text()).toContain('03 / 03');
    expect(text()).toContain('Чего хочется больше?');
    expect(text()).not.toContain('04 / 03');
    expect(button('Создать Личный миф')).toBeDefined();
    await typeInto('покоя'); await click('Создать Личный миф');
    const post = h.fetchMock.mock.calls.find(([u]) => u === '/api/personal-myth')!;
    expect(JSON.parse(post[1].body).answers).toEqual({ q1: 'Устал на работе', q2: '', q3: 'не помню', q4: 'покоя' });
  });

  it('the default (config not loaded) and the v4.1 rollback keep four questions', async () => {
    h.config = null;
    await render();
    expect(text()).toContain('Четыре вопроса');
    await click('Начать Личный миф');
    expect(text()).toContain('01 / 04');
  });
});

describe('finished myth rendering', () => {
  const show = async (result: any, inputs = { q1: 'а', q2: '', q3: 'б', q4: 'в' }) => render({ initialInputs: inputs, initialResult: result });

  it('v2a: story, then the two-column table, meaning, question, 7-day practice and the fixed line', async () => {
    await show(V2A_RESULT);
    const t = text();
    expect(t).toContain('Лампа в доме хранителя');
    const order = ['Первый абзац.', 'Из чего сделана сказка', 'Что это может значить сейчас', 'Вопрос', 'Практика на 7 дней', 'Если вы не узнали себя — это тоже ответ. Сказка — образ, не биография.'];
    const positions = order.map(s => t.indexOf(s));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    const rows = host.querySelectorAll('[data-testid="myth-made-of"] tbody tr');
    expect(rows).toHaveLength(5);
    expect(rows[0].querySelectorAll('td')).toHaveLength(2);
    expect(rows[0].textContent).toContain('Лампа');
    expect(rows[0].textContent).toContain('слово «устал» из первого ответа');
    expect(host.querySelector('[data-testid="myth-meaning"]')!.textContent).toContain('Возможно, это про выбор. Посмотрите, похоже ли.');
    expect(host.querySelector('[data-testid="myth-question"]')!.textContent).toContain('Что вы сделаете первым?');
    expect(host.querySelector('[data-testid="myth-practice"]')!.textContent).toContain('Как поймёте, что получилось');
    expect(host.querySelector('[data-testid="myth-fixed-line"]')).not.toBeNull();
    // 390 px: stacked cells (block below sm), not a fixed two-column grid.
    expect(rows[0].className).toContain('block');
    expect(rows[0].querySelector('td')!.className).toContain('block');
    // Old blocks are not shown for v2a, and the empty q2 is not listed among the answers.
    expect(t).not.toContain('Образ в вашем ответе');
    expect(t).toContain('Что вы рассказали в трёх ответах');
    expect(t).not.toContain('Образ состояния');
  });

  it('old v4.1 myth (title + story only) still renders as before', async () => {
    await show(OLD_V41, { q1: 'а', q2: 'в', q3: 'б', q4: 'г' });
    const t = text();
    expect(t).toContain('Старая сказка');
    expect(t).toContain('Старый текст.');
    expect(t).toContain('Что в ней отозвалось?');
    expect(t).toContain('Что вы рассказали в четырёх ответах');
    expect(t).not.toContain('Из чего сделана сказка');
  });

  it('old v1.5 myth (mirror blocks) still renders as before', async () => {
    await show(OLD_V15, { q1: 'а', q2: 'в', q3: 'б', q4: 'г' });
    const t = text();
    expect(t).toContain('Образ M');
    expect(t).toContain('Взгляд N');
    expect(t).toContain('Старый вопрос?');
    expect(t).not.toContain('Из чего сделана сказка');
  });
});
