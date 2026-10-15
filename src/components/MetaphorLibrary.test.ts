import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { MetaphorLibrary } from './MetaphorLibrary';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: new Proxy({}, { get: (_, tag: string) => React.forwardRef(({ children, initial, animate, exit, transition, layout, ...props }: any, ref) => React.createElement(tag, { ...props, ref }, children)) }),
}));

it('keeps keyboard focus in notes, restores it on close, and preserves saved notes on reopen', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  const saved = [{ id: 'synthetic-note', text: 'Синтетическая заметка для проверки', date: '15.10.2026', code: '5' }];
  localStorage.setItem('saved_metaphors', JSON.stringify(saved));
  const opener = document.createElement('button');
  const container = document.createElement('div');
  document.body.append(opener, container);
  opener.focus();
  const root = createRoot(container);
  const onClose = vi.fn();
  const render = async (isOpen: boolean) => {
    await act(async () => { root.render(React.createElement(MetaphorLibrary, { isOpen, onClose })); vi.runAllTimers(); });
    await act(async () => vi.runAllTimers());
  };
  try {
    await render(true);
    const close = container.querySelector('[aria-label="Закрыть заметки"]') as HTMLButtonElement;
    const remove = container.querySelector('[aria-label="Удалить заметку"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(remove);
    remove.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
    await render(false);
    expect(document.activeElement).toBe(opener);
    await render(true);
    expect(container.textContent).toContain(saved[0].text);
    expect(JSON.parse(localStorage.getItem('saved_metaphors')!)).toEqual(saved);
  } finally {
    await act(async () => root.unmount());
    container.remove(); opener.remove(); localStorage.removeItem('saved_metaphors'); vi.useRealTimers();
  }
});
