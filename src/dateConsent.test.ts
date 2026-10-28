import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { calculateCanonicalCodeV2 } from '../server/dcsBridge';
import { CONSENT_VERSION } from './services/consent';
import { DATE_CONSENT_REQUIRED_MESSAGE } from './components/DateConsentField';
import App from './App';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: new Proxy({}, { get: (_, tag: string) => React.forwardRef(({ children, initial, animate, exit, transition, whileHover, whileTap, whileInView, viewport, layout, ...props }: any, ref) => React.createElement(tag, { ...props, ref }, children)) }),
}));

let container: HTMLDivElement;
let root: Root;

async function typeDate(values = ['18', '12', '1989']) {
  const fields = [...container.querySelectorAll('input:not([type=checkbox])')].slice(0, 3);
  await act(async () => {
    fields.forEach((field, i) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, values[i]);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}
async function submit() {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Посмотреть свой разбор')!;
  await act(async () => { button.click(); });
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, '', '/?preview=v2');
  window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as any;
  Element.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('consent at the moment of date entry (release 14)', () => {
  it('consent version is the new one, not the 2026-09 version', () => {
    expect(CONSENT_VERSION).toBe('zerkalo-2026-10-v2');
  });

  it('home opens without a consent dialog and without any consent/personal-data request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ enabled: false })));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(React.createElement(App)));
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
    expect(container.querySelector('[data-testid="date-consent"]')).not.toBeNull();
    const urls = fetchMock.mock.calls.map(c => String((c as any)[0]));
    expect(urls.filter(u => u.includes('/api/consent') || u.includes('/api/code-v2') || u.includes('/api/calculate'))).toEqual([]);
  });

  it('without the mark the date is not sent to the server and no dialog opens', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ enabled: false })));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(React.createElement(App)));
    await typeDate();
    await submit();
    expect(container.textContent).toContain(DATE_CONSENT_REQUIRED_MESSAGE);
    const urls = fetchMock.mock.calls.map(c => String((c as any)[0]));
    expect(urls.filter(u => u.includes('/api/consent') || u.includes('/api/code-v2'))).toEqual([]);
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
  });

  it('with the mark: consent of the current version is recorded first, then the date is sent', async () => {
    const payload = await calculateCanonicalCodeV2('18.12.1989');
    const calls: { url: string; body?: any }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === '/api/consent') return new Response(JSON.stringify({ accepted: true }), { status: 200 });
      if (url === '/api/code-v2') return new Response(JSON.stringify({ status: 'ok', payload }), { status: 200 });
      return new Response(JSON.stringify({ enabled: false }));
    }));
    await act(async () => root.render(React.createElement(App)));
    await typeDate();
    await act(async () => { (container.querySelector('input[type=checkbox]') as HTMLInputElement).click(); });
    await submit();
    const consentIdx = calls.findIndex(c => c.url === '/api/consent' && c.body);
    const codeIdx = calls.findIndex(c => c.url === '/api/code-v2');
    expect(consentIdx).toBeGreaterThanOrEqual(0);
    expect(codeIdx).toBeGreaterThan(consentIdx);
    expect(calls[consentIdx].body).toMatchObject({ accepted: true, adult: true, version: CONSENT_VERSION, scope: 'core' });
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
  });
});
