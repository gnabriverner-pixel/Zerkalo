import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentBoundary, useProtectedFetch } from './ConsentBoundary';

let host: HTMLDivElement;
let root: Root;

function Probe() {
  const protectedFetch = useProtectedFetch();
  const [date, setDate] = useState('18.12.1989');
  const [status, setStatus] = useState('');
  return React.createElement('div', {},
    React.createElement('input', { value: date, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDate(event.target.value) }),
    React.createElement('button', { onClick: async () => {
      const response = await protectedFetch('/api/code-v2', { method: 'POST', body: JSON.stringify({ dob: date }) });
      setStatus(response ? String(response.status) : 'cancelled');
    } }, 'Открыть код'),
    React.createElement('output', {}, status));
}

async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(element => element.textContent === text);
  expect(button).toBeDefined();
  await act(async () => { button!.click(); await Promise.resolve(); });
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('first protected request', () => {
  it('shows the page first; cancellation keeps input and sends no personal data', async () => {
    let accepted = false;
    let dataPosts = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/api/consent' && init?.method === 'POST') {
        accepted = true;
        return new Response(JSON.stringify({ accepted: true }), { status: 200 });
      }
      if (input === '/api/consent') return new Response(JSON.stringify({ accepted }), { status: 200 });
      dataPosts += 1;
      return new Response('{}', { status: 200 });
    }));

    await act(async () => root.render(React.createElement(ConsentBoundary, { children: React.createElement(Probe) })));
    expect(host.querySelector('input')?.getAttribute('value')).toBe('18.12.1989');
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(dataPosts).toBe(0);

    await click('Открыть код');
    expect(host.querySelector('[role=dialog]')).not.toBeNull();
    expect(dataPosts).toBe(0);
    await click('Сейчас не хочу');
    expect(dataPosts).toBe(0);
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('18.12.1989');

    await click('Открыть код');
    expect((host.querySelector('[role=dialog] input[type=checkbox]') as HTMLInputElement).checked).toBe(false);
    await act(async () => { (host.querySelector('[role=dialog] input[type=checkbox]') as HTMLInputElement).click(); });
    await click('Согласиться и продолжить');
    expect(dataPosts).toBe(1);
    await click('Открыть код');
    expect(dataPosts).toBe(2);
    expect(host.querySelector('[role=dialog]')).toBeNull();
  });

  it('does not send on recording failure and reopens on an expired receipt', async () => {
    let accepted = false;
    let failConsent = true;
    let protectedPosts = 0;
    let expiredOnce = true;
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/api/consent' && init?.method === 'POST') {
        if (failConsent) return new Response('{}', { status: 503 });
        accepted = true;
        return new Response(JSON.stringify({ accepted: true }), { status: 200 });
      }
      if (input === '/api/consent') return new Response(JSON.stringify({ accepted }), { status: 200 });
      protectedPosts += 1;
      if (expiredOnce) {
        expiredOnce = false;
        return new Response(JSON.stringify({ code: 'consent_required' }), { status: 403 });
      }
      return new Response('{}', { status: 200 });
    }));

    await act(async () => root.render(React.createElement(ConsentBoundary, { children: React.createElement(Probe) })));
    await click('Открыть код');
    await act(async () => { (host.querySelector('[role=dialog] input[type=checkbox]') as HTMLInputElement).click(); });
    await click('Согласиться и продолжить');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Согласие не сохранено');
    expect(protectedPosts).toBe(0);

    failConsent = false;
    await click('Согласиться и продолжить');
    expect(host.querySelector('[role=dialog]')).not.toBeNull();
    expect(protectedPosts).toBe(1);
    expect((host.querySelector('[role=dialog] input[type=checkbox]') as HTMLInputElement).checked).toBe(false);
    await act(async () => { (host.querySelector('[role=dialog] input[type=checkbox]') as HTMLInputElement).click(); });
    await click('Согласиться и продолжить');
    expect(protectedPosts).toBe(2);
    expect(host.querySelector('output')?.textContent).toBe('200');
  });
});
