import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { calculateCanonicalCodeV2 } from '../server/dcsBridge';
import { CONSENT_VERSION, hasConsentMark } from './services/consent';
import { DATE_CONSENT_REQUIRED_MESSAGE } from './components/DateConsentField';
import { freeWindowLine } from './services/freeWindowLine';
import { MYTH_COPY } from './services/mythWait';
import App from './App';

// One stable component per tag: a fresh type on every access would remount the whole tree on each render and hide state bugs.
const motionCache: Record<string, any> = {};
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: new Proxy({}, { get: (_, tag: string) => (motionCache[tag] ||= React.forwardRef(({ children, initial, animate, exit, transition, whileHover, whileTap, whileInView, viewport, layout, ...props }: any, ref) => React.createElement(tag, { ...props, ref }, children))) }),
}));

let container: HTMLDivElement;
let root: Root;

const dateFields = () => [...container.querySelectorAll('input:not([type=checkbox])')].slice(0, 3) as HTMLInputElement[];
async function typeDate(values: string[]) {
  await act(async () => {
    dateFields().forEach((field, i) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, values[i]);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}
const buttonByText = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
async function submit() { await act(async () => { buttonByText('Посмотреть свой разбор')!.click(); }); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
const tick = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, '', '/?preview=v2');
  window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as any;
  Element.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

async function stubServer(options: { consentGetAccepted: boolean }) {
  const payloads: Record<string, any> = {};
  for (const d of ['18.12.1989', '01.07.1990', '14.03.1987']) payloads[d] = await calculateCanonicalCodeV2(d);
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method || 'GET' });
    if (url === '/api/consent') {
      return new Response(JSON.stringify({ accepted: init?.method === 'POST' ? true : options.consentGetAccepted }), { status: 200 });
    }
    if (url === '/api/code-v2') {
      const dob = JSON.parse(String(init!.body)).dob;
      return new Response(JSON.stringify({ status: 'ok', payload: payloads[dob] }), { status: 200 });
    }
    return new Response(JSON.stringify({ enabled: false }));
  }));
  return calls;
}

describe('«Изменить дату»', () => {
  it('clears the old date, takes a new one and shows the new result', async () => {
    await stubServer({ consentGetAccepted: true });
    await act(async () => root.render(React.createElement(App)));
    await typeDate(['18', '12', '1989']);
    await act(async () => { (container.querySelector('input[type=checkbox]') as HTMLInputElement).click(); });
    await submit();
    expect(container.textContent).toContain('18.12.1989');
    await act(async () => { buttonByText('Изменить дату')!.click(); });
    await tick();
        expect(dateFields().map(f => f.value)).toEqual(['', '', '']);
    await typeDate(['01', '07', '1990']);
    expect(dateFields().map(f => f.value)).toEqual(['01', '07', '1990']);
    await submit();
    expect(container.textContent).toContain('01.07.1990');
    expect(container.textContent).not.toContain('Пример разбора');
  });
});

describe('consent dialog never opens on the date path', () => {
  it('even if the server later answers "not accepted" to a check, no dialog opens over the loading state', async () => {
    const calls = await stubServer({ consentGetAccepted: false });
    await act(async () => root.render(React.createElement(App)));
    await typeDate(['18', '12', '1989']);
    await act(async () => { (container.querySelector('input[type=checkbox]') as HTMLInputElement).click(); });
    await submit();
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
    expect(container.textContent).toContain('18.12.1989');
    expect(calls.filter(c => c.url === '/api/consent' && c.method === 'GET')).toEqual([]);
  });

  it('accepting remembers the mark locally; after a reload the mark is not asked again and nothing is requested before the click', async () => {
    let calls = await stubServer({ consentGetAccepted: true });
    await act(async () => root.render(React.createElement(App)));
    await typeDate(['18', '12', '1989']);
    await act(async () => { (container.querySelector('input[type=checkbox]') as HTMLInputElement).click(); });
    await submit();
    expect(hasConsentMark()).toBe(true);
    expect(JSON.parse(localStorage.getItem('zerkalo.consent.mark')!).v).toBe(CONSENT_VERSION);
    await act(async () => root.unmount());
    container.remove();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    calls = await stubServer({ consentGetAccepted: true });
    await act(async () => root.render(React.createElement(App)));
    expect(container.querySelector('[data-testid="date-consent"]')).toBeNull();
    expect(calls.filter(c => c.url.includes('/api/consent') || c.url.includes('/api/code-v2'))).toEqual([]);
    await typeDate(['01', '07', '1990']);
    await submit();
    expect(calls.some(c => c.url === '/api/consent' && c.method === 'GET')).toBe(true);
    expect(calls.some(c => c.url === '/api/code-v2')).toBe(true);
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
  });

  it('a stale local reminder with no server consent brings the mark back and sends no date', async () => {
    localStorage.setItem('zerkalo.consent.mark', JSON.stringify({ v: CONSENT_VERSION, t: Date.now() }));
    const calls = await stubServer({ consentGetAccepted: false });
    await act(async () => root.render(React.createElement(App)));
    await typeDate(['18', '12', '1989']);
    await submit();
    expect(container.textContent).toContain(DATE_CONSENT_REQUIRED_MESSAGE);
    expect(container.querySelector('[data-testid="date-consent"]')).not.toBeNull();
    expect(calls.filter(c => c.url === '/api/code-v2')).toEqual([]);
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
    expect(hasConsentMark()).toBe(false);
  });

  it('an old reminder of another version is ignored', () => {
    localStorage.setItem('zerkalo.consent.mark', JSON.stringify({ v: 'zerkalo-2026-09', t: Date.now() }));
    expect(hasConsentMark()).toBe(false);
  });
});

describe('example banner', () => {
  it('does not stay over the result of a date the person entered', async () => {
    window.history.replaceState({}, '', '/?mode=code&sample=1');
    await stubServer({ consentGetAccepted: true });
    await act(async () => root.render(React.createElement(App)));
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    // the sample may be shown (if the sample calculation ran) — in any case, a date entered by the person ends it
    if (container.textContent?.includes('Пример разбора')) await act(async () => { buttonByText('Ввести свою дату')!.click(); });
    await tick();
    await typeDate(['14', '03', '1987']);
    await act(async () => { (container.querySelector('input[type=checkbox]') as HTMLInputElement).click(); });
    await submit();
    expect(container.textContent).toContain('14.03.1987');
    expect(container.textContent).not.toContain('Пример разбора');
    expect(container.textContent).not.toContain('Пример пяти чисел');
  });
});

describe('date typed on the home form', () => {
  const homeFields = () => [...container.querySelectorAll('#birth-day, #birth-month, #birth-year')] as HTMLInputElement[];
  async function typeHome(values: string[]) {
    await act(async () => {
      homeFields().forEach((field, i) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, values[i]);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }
  const submitHome = async () => { await act(async () => { buttonByText('Посмотреть свой разбор')!.click(); }); await act(async () => { await new Promise(r => setTimeout(r, 30)); }); };

  it('asks for the mark under the date and sends nothing without it', async () => {
    window.history.replaceState({}, '', '/');
    const calls = await stubServer({ consentGetAccepted: true });
    await act(async () => root.render(React.createElement(App)));
    expect(container.querySelector('[data-testid="date-consent"]')).not.toBeNull();
    await typeHome(['14', '03', '1987']);
    await submitHome();
    expect(container.textContent).toContain(DATE_CONSENT_REQUIRED_MESSAGE);
    expect(calls.filter(c => c.url.includes('/api/consent') || c.url.includes('/api/code-v2'))).toEqual([]);
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
  });

  it('with the mark: consent first, no dialog over the loading state, and the sample banner never shows on the person\'s own 14.03.1987', async () => {
    window.history.replaceState({}, '', '/');
    const calls = await stubServer({ consentGetAccepted: false });
    await act(async () => root.render(React.createElement(App)));
    await typeHome(['14', '03', '1987']);
    await act(async () => { (container.querySelector('input[type=checkbox]') as HTMLInputElement).click(); });
    await submitHome();
    const consentIdx = calls.findIndex(c => c.url === '/api/consent' && c.method === 'POST');
    const codeIdx = calls.findIndex(c => c.url === '/api/code-v2');
    expect(consentIdx).toBeGreaterThanOrEqual(0);
    expect(codeIdx).toBeGreaterThan(consentIdx);
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
    expect(container.textContent).toContain('Ваши пять чисел');
    expect(container.textContent).not.toContain('Пример разбора');
  });
});

describe('free window line and create note', () => {
  const status = (over: any = {}) => ({ enabled: true, active: true, phase: 'open', can_start_myth: true, new_generation_available: true, pause_message: '', support_url: null, started_at: 1, ends_at: Date.UTC(2026, 10, 10, 12), budget_warning: false, ...over });
  it('is built from ends_at and is silent without an active window', () => {
    expect(freeWindowLine(status())).toBe('Пробный доступ — бесплатно до 10 ноября включительно.');
    expect(freeWindowLine(status({ active: false }))).toBeNull();
    expect(freeWindowLine(status({ ends_at: null }))).toBeNull();
    expect(freeWindowLine(null)).toBeNull();
  });
  it('the create note says time, AI and one attempt', () => {
    expect(MYTH_COPY.createNote).toBe('Займёт 1–3 минуты. Ответы уходят ИИ, чтобы написать историю. Одна бесплатная история на этот браузер.');
  });
});

describe('one path: secondary screens are off by default', () => {
  const navTexts = () => [...container.querySelectorAll('button')].map(b => b.textContent?.trim());
  it('home and header show no Meeting, «О методе» or «Мир девяти светил»; Code, Myth and «Мои мифы» stay', async () => {
    window.history.replaceState({}, '', '/');
    await stubServer({ consentGetAccepted: true });
    await act(async () => root.render(React.createElement(App)));
    const text = container.textContent ?? '';
    expect(navTexts()).not.toContain('Встреча');
    expect(navTexts()).not.toContain('О методе');
    expect(text).not.toContain('Мир девяти светил');
    expect(text).not.toContain('Встреча Зеркал');
    expect(navTexts()).toContain('Миф');
    expect(text).toContain('Посмотреть свой разбор');
  });
  it('the flag brings them back', async () => {
    vi.stubEnv('VITE_SHOW_SECONDARY_PATHS', 'true');
    window.history.replaceState({}, '', '/');
    await stubServer({ consentGetAccepted: true });
    await act(async () => root.render(React.createElement(App)));
    expect(container.textContent).toContain('Мир девяти светил');
    expect(navTexts()).toContain('О методе');
    vi.unstubAllEnvs();
  });
});

describe('Myth timeout and waiting', () => {
  it('server default is 240 s per call and the client waits longer than two calls', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const serverSource = fs.readFileSync(path.resolve(__dirname, '../server.ts'), 'utf8');
    expect(serverSource).toContain('|| 240_000');
    expect(serverSource).not.toContain("'v2a' ? 180_000");
    const { MYTH_TOTAL_WAIT_MS } = await import('./services/mythWait');
    expect(MYTH_TOTAL_WAIT_MS).toBeGreaterThan(2 * 240_000);
  });
  it('the policy says the session cookie is technically necessary and lives until the browser closes', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const html = fs.readFileSync(path.resolve(__dirname, '../public/privacy.html'), 'utf8');
    expect(html).toContain('технически необходима, чтобы вернуть вам ждущий результат Мифа');
    expect(html).toContain('zerkalo.consent.mark');
  });
});
