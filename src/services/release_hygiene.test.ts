import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: new Proxy({}, {
    get: (_, tag: string) =>
      React.forwardRef(
        ({ children, initial, animate, exit, transition, whileHover, whileTap, whileInView, viewport, layout, ...props }: any, ref) =>
          React.createElement(tag, { ...props, ref }, children)
      ),
  }),
}));

vi.mock('../components/PersonalMyth', () => ({
  default: () => React.createElement('div', { 'data-testid': 'mock-myth' }, 'Mock Myth'),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as any;
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Release Hygiene Frontend Suite', () => {
  it('sanitizes ?dob= from URL query immediately and does NOT use it as input', async () => {
    // Simulate user landing with a sensitive DOB in the URL (synthetic fixture)
    window.history.replaceState({}, '', '/?preview=v2&dob=03.03.2003');

    await act(async () => {
      root.render(React.createElement(App));
    });

    // 1. URL must be stripped of ?dob=
    const currentUrl = new URL(window.location.href);
    expect(currentUrl.searchParams.has('dob')).toBe(false);
    expect(currentUrl.searchParams.get('preview')).toBe('v2');

    // 2. The date inputs must remain empty (no auto-fill from query string)
    const inputs = [...container.querySelectorAll('input')];
    inputs.forEach((input) => {
      expect(input.value).toBe('');
    });

    // 3. Must not have triggered auto-calculation
    expect(container.textContent).toContain('Ваш Цифровой Код');
    expect(container.textContent).toContain('Открыть мой Код');
  });

  it('ignores ?qa=1 in simulated production environment', async () => {
    // Simulate production environment where DEV is false
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as any).DEV = false;

      window.history.replaceState({}, '', '/?preview=v2&qa=1');

      await act(async () => {
        root.render(React.createElement(App));
      });

      // QA bar and presets must NOT appear in production
      expect(container.textContent).not.toContain('Digital Code V2 · QA Режим');
      expect(container.textContent).not.toContain('Контрольные даты для проверки (QA Режим)');
      expect(container.textContent).not.toContain('qa=1');
      // The owner's V2 preview badge is QA-only copy and is loaded from the same
      // dev-only module — it must not render in production either.
      expect(container.textContent).not.toContain('V2 PREVIEW');
      expect(document.title).not.toContain('QA Режим');
    } finally {
      (import.meta.env as any).DEV = originalDev;
    }
  });

  it('does not render dead laboratory ModelComparisonHarness in DOM', async () => {
    window.history.replaceState({}, '', '/');

    await act(async () => {
      root.render(React.createElement(App));
    });

    expect(container.textContent).not.toContain('Что внутри требует внимания');
    expect(container.textContent).not.toContain('A/B Comparison');
    expect(container.querySelector('[data-testid="model-comparison-harness"]')).toBeNull();
  });
});
