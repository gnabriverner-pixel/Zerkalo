import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentBoundary } from './components/ConsentBoundary';
import { PersonalStoryLibrary } from './components/PersonalStoryLibrary';
import { SiteFooter } from './components/SiteFooter';
import { MythExamplePage, isMythExamplePath } from './components/MythExamplePage';
import { STORY_PRICE_LABEL } from './services/storyPrice';
import { ALBERT_CONVERSATION_STORAGE_KEY } from './services/albertOpenerState';
import { clearTransientDraft, deleteMyMirrorSnapshot } from './services/myMirrorStorage';
import { requestServerDeletion } from './services/serverDeletion';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('screen after the free window', () => {
  it('offers the Personal Myth with the price from one place and an inactive pay button', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/free-preview') return new Response(JSON.stringify({ enabled: true, active: false, phase: 'ended', can_start_myth: false, new_generation_available: false, pause_message: '', support_url: null, started_at: 1, ends_at: 2 }));
      return new Response(JSON.stringify({ enabled: false, payment_mode: 'disabled', storage_accepted: false }));
    }));
    await act(async () => root.render(React.createElement(ConsentBoundary, null, React.createElement(PersonalStoryLibrary, { isOpen: true, onClose: () => {}, onStoriesDeleted: () => {} }))));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const offer = container.querySelector('[data-testid="story-offer"]');
    expect(offer).not.toBeNull();
    expect(offer!.textContent).toContain(STORY_PRICE_LABEL);
    expect(offer!.textContent).toContain('Оплата скоро откроется');
    const button = offer!.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(offer!.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(offer!.textContent).toContain('Оплачивая, вы принимаете');
    expect(container.textContent).not.toContain('Пробный доступ завершён');
  });
});

describe('footer on every page', () => {
  it('React footer links the offer and the policy and shows contacts without bracketed placeholders', async () => {
    await act(async () => root.render(React.createElement(SiteFooter)));
    expect(container.querySelector('footer a[href="/terms"]')).not.toBeNull();
    expect(container.querySelector('footer a[href="/privacy"]')).not.toBeNull();
    expect(container.textContent).toContain('Контакты:');
    expect(container.textContent).not.toMatch(/[\[\]]/);
  });
  it('static pages carry the footer too', () => {
    for (const f of ['public/privacy.html', 'public/terms.html']) {
      const html = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
      expect(html, f).toContain('data-site-footer');
      expect(html, f).toContain('href="/terms"');
      expect(html, f).toContain('href="/privacy"');
    }
  });
  it('policy and offer are the new texts: operator placeholder, no DeepSeek-only claim, no old edition', () => {
    const privacy = fs.readFileSync(path.resolve(__dirname, '../public/privacy.html'), 'utf8');
    const terms = fs.readFileSync(path.resolve(__dirname, '../public/terms.html'), 'utf8');
    expect(privacy).toContain('{{OPERATOR_REQ_HTML}}');
    expect(privacy).toContain('zerkalo-2026-10-v2');
    expect(privacy).not.toContain('Указывается оператор');
    expect(terms).toContain('Договор-оферта');
    expect(terms).not.toContain('безвозмездной основе');
  });
});

describe('deleting the mirror and clearing the draft also erase the Albert conversation', () => {
  const seed = () => {
    const v = JSON.stringify({ version: 1, messages: [{ text: 'синтетика' }] });
    localStorage.setItem(ALBERT_CONVERSATION_STORAGE_KEY, v);
    sessionStorage.setItem(ALBERT_CONVERSATION_STORAGE_KEY, v);
  };
  it('deleteMyMirrorSnapshot', () => {
    seed(); deleteMyMirrorSnapshot();
    expect(localStorage.getItem(ALBERT_CONVERSATION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(ALBERT_CONVERSATION_STORAGE_KEY)).toBeNull();
  });
  it('clearTransientDraft', () => {
    seed(); clearTransientDraft();
    expect(localStorage.getItem(ALBERT_CONVERSATION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(ALBERT_CONVERSATION_STORAGE_KEY)).toBeNull();
  });
});

describe('deletion interface calls /api/delete-data', () => {
  it('posts to the endpoint and reports the outcome without throwing', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    expect(await requestServerDeletion()).toBe('deleted');
    expect((f.mock.calls[0] as any)[0]).toBe('/api/delete-data');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'deletion_scope_not_found' }), { status: 400 })));
    expect(await requestServerDeletion()).toBe('nothing_to_delete');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await requestServerDeletion()).toBe('failed');
  });
});

describe('public Myth example (mode A)', () => {
  it('shows the same screen as the real Myth: tale, made-of table, meaning, question, 7-day practice, not-recognised line, fictional-person note', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await act(async () => root.render(React.createElement(MythExamplePage)));
    const text = container.textContent ?? '';
    expect(container.querySelector('[data-testid="myth-title"]')?.textContent).toBe('Вторая лампа');
    expect(container.querySelector('[data-testid="myth-example-banner"]')?.textContent).toContain('Пример для вымышленного человека');
    expect(text).toContain('Что вы рассказали в трёх ответах');
    expect(text).toContain('Близости, в которой остаётся своё место');
    expect(container.querySelectorAll('[data-testid="myth-made-of"] tbody tr').length).toBe(7);
    expect(container.querySelector('[data-testid="myth-meaning"]')?.textContent).toContain('свой угол внутри неё');
    expect(container.querySelector('[data-testid="myth-question"]')?.textContent).toContain('О каком своём вечере');
    expect(container.querySelector('[data-testid="myth-practice"]')?.textContent).toContain('Семь дней');
    expect(container.querySelector('[data-testid="myth-fixed-line"]')?.textContent).toContain('не узнали себя');
    expect(text).not.toContain('Велосипед');
    expect(container.querySelector('footer[data-site-footer]')).not.toBeNull();
    // Only the footer's read-only config request is allowed: no generation or other API call.
    expect(fetchSpy.mock.calls.every(c => String(c[0]) === '/api/personal-myth/config')).toBe(true);
  });
  it('recognises the route with and without a trailing slash', () => {
    expect(isMythExamplePath('/primer-lichnogo-mifa')).toBe(true);
    expect(isMythExamplePath('/primer-lichnogo-mifa/')).toBe(true);
    expect(isMythExamplePath('/')).toBe(false);
  });
});
