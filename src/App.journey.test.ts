import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { calculateCanonicalCodeV2 } from '../server/dcsBridge';
import { loadTransientDraft } from './services/myMirrorStorage';
import App from './App';

// Only animation and external Myth generation are fixtures; App, Code V2,
// Meeting and persistence below are the actual production components.
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: new Proxy({}, { get: (_, tag: string) => React.forwardRef(({ children, initial, animate, exit, transition, whileHover, whileTap, whileInView, viewport, layout, ...props }: any, ref) => React.createElement(tag, { ...props, ref }, children)) }),
}));
vi.mock('./components/PersonalMyth', () => ({ default: ({ onMythCompleted, onNavigateToMeeting }: any) => React.createElement('div', {},
  React.createElement('button', { onClick: () => onMythCompleted({q1:'Хочу исследовать',q2:'Образа нет',q3:'Спокойствие',q4:'Ясность'}, {title:'Тестовый миф',story:'Синтетический ответ',mirror:{mainImage:'Окно'},meaning:[],one_step:'Пауза',journal_question:'Что заметили?',disclaimer:'Образ'}) }, 'Готовый тестовый миф'),
  React.createElement('button', { onClick: onNavigateToMeeting }, 'Продолжить тестовую встречу')) }));
let container: HTMLDivElement;
let root: Root;
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === text);
  expect(button, text).toBeDefined();
  await act(async () => { button!.click(); });
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, '', '/?preview=v2&dob=18.12.1989');
  window.matchMedia = vi.fn(() => ({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})) as any;
  Element.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe('actual V2 journey', () => {
  it('Code → Myth → Meeting keeps the accepted Code and restores it after a reload', async () => {
    const payload = await calculateCanonicalCodeV2('18.12.1989');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({status:'ok', payload}), {status:200}));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => { root.render(React.createElement(App)); });
    expect(container.textContent).toContain(payload.central_motif);
    expect(loadTransientDraft()?.codeResult).toEqual(payload.calculation.canonical_result);
    const journey = loadTransientDraft()?.journeyId;
    await click('Перейти к Личному мифу');
    await click('Готовый тестовый миф');
    await click('Продолжить тестовую встречу');
    expect(container.textContent).not.toContain('Не рассчитано');
    expect(loadTransientDraft()?.journeyId).toBe(journey);
    expect(loadTransientDraft()?.firstMirror?.interpretationVersion).toBe('v2');
    expect(loadTransientDraft()?.storyInputs?.q2).toBe('Образа нет');
    await act(async () => root.unmount());
    root = createRoot(container); window.history.replaceState({}, '', '/');
    await act(async () => root.render(React.createElement(App)));
    await click('Продолжить');
    expect(container.textContent).not.toContain('Не рассчитано');
    expect(loadTransientDraft()?.journeyId).toBe(journey);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('Myth first remains independent; calculating later joins the same experience', async () => {
    const payload = await calculateCanonicalCodeV2('18.12.1989');
    window.history.replaceState({}, '', '/');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({status:'ok',payload})));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => root.render(React.createElement(App)));
    await click('Миф');
    await click('Готовый тестовый миф');
    const before = loadTransientDraft();
    expect(before?.codeResult).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await click('Продолжить тестовую встречу');
    // Enter the synthetic date using React input events, as the browser would.
    const values = ['18', '12', '1989'];
    const fields = [...container.querySelectorAll('input')];
    expect(fields).toHaveLength(3);
    await act(async () => {
      fields.forEach((field, i) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, values[i]);
        field.dispatchEvent(new Event('input', {bubbles:true}));
      });
    });
    await click('Открыть мой Код');
    await click('Открыть Встречу зеркал');
    expect(container.textContent).not.toContain('Не рассчитано');
    expect(loadTransientDraft()?.storyResult).toEqual(before?.storyResult);
    expect(loadTransientDraft()?.journeyId).toBe(before?.journeyId);
  });
  it('changing the date removes the old draft instead of resurrecting it on reload', async () => {
    const payload = await calculateCanonicalCodeV2('18.12.1989');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({status:'ok',payload}))));
    await act(async () => root.render(React.createElement(App)));
    expect(loadTransientDraft()?.codeV2Payload).toBeDefined();
    await click('Изменить дату');
    expect(loadTransientDraft()).toBeNull();
    expect(container.textContent).not.toContain(payload.central_motif);
  });

  it('carries the server correction and personal note from Code into the next conversation without sending DOB', async () => {
    const payload = await calculateCanonicalCodeV2('18.12.1989');
    const truth = {expiresAt:new Date(Date.now()+60000).toISOString(),evidence:[{source:'user_correction',receipt:'test-opaque-receipt',reaction_quote:'Это не про меня'}]};
    const requests: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (url === '/api/code-v2') return new Response(JSON.stringify({status:'ok',payload}));
      requests.push(JSON.parse(init.body));
      return new Response(JSON.stringify({status:'ok',message:'Учитываю вашу поправку.',truthState:truth}));
    }));
    const fill = async (selector: string, value: string) => {
      const field = container.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      expect(field).toBeTruthy();
      await act(async () => {
        const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
        field.dispatchEvent(new Event('input', {bubbles:true}));
      });
    };
    const ariaClick = async (label: string) => { await act(async () => (container.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click()); };
    await act(async () => root.render(React.createElement(App)));
    await click('Обсудить с Альбертом');
    await fill('input[placeholder^="Задайте"]', 'Это не про меня');
    await ariaClick('Отправить сообщение');
    await fill('textarea[aria-label="Моя мысль после разговора"]', 'Я выбираю равноправие.');
    await ariaClick('Закрыть диалог');
    await click('Перейти к Личному мифу');
    await click('Готовый тестовый миф');
    await click('Продолжить тестовую встречу');
    // Return to Code; the same global conversation must survive both transitions.
    await click('Код');
    await click('Обсудить с Альбертом');
    expect(container.textContent).toContain('Учитываю вашу поправку.');
    await fill('input[placeholder^="Задайте"]', 'Что я уточнил?');
    await ariaClick('Отправить сообщение');
    expect(requests[1].truthState).toEqual(truth);
    expect(requests[1].context.userNote).toBe('Я выбираю равноправие.');
    expect(requests[1].context.mythAnchors.title).toBe('Тестовый миф');
    expect(JSON.stringify(requests)).not.toContain('18.12.1989');
    expect(loadTransientDraft()?.meetingUserNote).toBe('Я выбираю равноправие.');
  });

});
