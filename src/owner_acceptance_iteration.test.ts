import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveTransientDraft,
  loadTransientDraft,
  saveMyMirrorSnapshot,
  loadMyMirrorSnapshot,
  isSnapshotMatchingCurrentSession,
} from './services/myMirrorStorage';
import { buildMeetingOfMirrorsPrompt } from './services/mythPrompts';
import { calculateDigitalCode } from './services/calculator';
import { generateFirstMirror } from './services/interpretation';
import { deriveMeetingCacheKey } from '../server/meeting';
import { createContinuationClaim, LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE } from '../server/handoff';
import { TelegramContinuation } from './components/TelegramContinuation';
import { ConsentBoundary } from './components/ConsentBoundary';
import PersonalMyth from './components/PersonalMyth';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        React.forwardRef(
          ({ children, initial, animate, exit, transition, whileHover, whileTap, whileInView, viewport, layout, ...props }: any, ref) =>
            React.createElement(tag, { ...props, ref }, children)
        ),
    }
  ),
}));

describe('Owner acceptance iteration: personal question, direct address, and local Telegram guard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ accepted: true }))));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    delete process.env.STAGE1_LOCAL_CANDIDATE_MODE;
  });

  it('persists userQuestion in TransientDraftV1 and MyMirrorSnapshotV1 with backward compatibility', () => {
    const calc = calculateDigitalCode('14.08.1991');
    const firstMirror = generateFirstMirror(calc);
    const storyInputs = { q1: 'Вопрос о выборе роли', q2: 'Мост', q3: 'Сделал набросок', q4: 'Ясности' };
    const storyResult: any = {
      title: 'Мост у воды',
      story: 'Ты стоишь у моста.',
      mirror: { mainImage: 'Мост', innerTension: 'Пауза', hiddenResource: 'Опора', newView: 'Ракурс' },
      meaning: ['Смысл'],
      one_step: 'Шаг',
      journal_question: 'Вопрос?',
      disclaimer: 'Дисклеймер',
    };
    const meetingResult: any = {
      summary: 'Что вы рассказали.',
      hasStrongParallels: true,
      confidenceNote: 'Связь',
      possibleSupport: 'Опора в вашем ответе.',
      parallels: [],
      divergences: [],
      albertInsight: 'Новый ракурс.',
      reflectiveQuestion: 'Вопрос к вам?',
      disclaimer: 'Дисклеймер',
    };

    saveTransientDraft({
      mode: 'alabaster',
      codeDate: '14.08.1991',
      userQuestion: 'Как мне выбрать между двумя проектами без потери темпа?',
      codeResult: calc,
      codeV2Payload: null,
      firstMirror,
      storyInputs: null,
      storyResult: null,
      meetingResult: null,
      meetingUserNote: '',
    });

    const loadedDraft = loadTransientDraft();
    expect(loadedDraft?.userQuestion).toBe('Как мне выбрать между двумя проектами без потери темпа?');

    saveMyMirrorSnapshot({
      codeDate: '14.08.1991',
      userQuestion: 'Как мне выбрать между двумя проектами без потери темпа?',
      codeResult: calc,
      firstMirror,
      storyInputs,
      storyResult,
      meetingResult,
    });

    const loadedSnap = loadMyMirrorSnapshot();
    expect(loadedSnap?.userQuestion).toBe('Как мне выбрать между двумя проектами без потери темпа?');
    expect(
      isSnapshotMatchingCurrentSession(loadedSnap, {
        codeDate: '14.08.1991',
        userQuestion: 'Как мне выбрать между двумя проектами без потери темпа?',
        codeResult: calc,
        firstMirror,
        storyInputs,
        storyResult,
        meetingResult,
      })
    ).toBe(true);
    expect(
      isSnapshotMatchingCurrentSession(loadedSnap, {
        codeDate: '14.08.1991',
        userQuestion: 'Другой вопрос',
        codeResult: calc,
        firstMirror,
        storyInputs,
        storyResult,
        meetingResult,
      })
    ).toBe(false);
  });

  it('pre-fills q1 in PersonalMyth from userQuestion only when q1 is empty and never overwrites edited q1 or q2-q4', async () => {
    const observedInputs: any[] = [];
    await act(async () => {
      root.render(
        React.createElement(
          ConsentBoundary,
          null,
          React.createElement(PersonalMyth, {
            initialInputs: null,
            initialResult: null,
            userQuestion: 'Стоит ли сейчас менять команду или сначала передоговориться о границах?',
            onInputsChange: (inp) => observedInputs.push(inp),
          })
        )
      );
    });

    expect(observedInputs.at(-1)).toEqual({
      q1: 'Стоит ли сейчас менять команду или сначала передоговориться о границах?',
      q2: '',
      q3: '',
      q4: '',
    });

    // If q1 already has content, changing userQuestion does not overwrite it
    await act(async () => {
      root.render(
        React.createElement(
          ConsentBoundary,
          null,
          React.createElement(PersonalMyth, {
            initialInputs: {
              q1: 'Мой уже отредактированный ответ в Мифе',
              q2: 'Часы на столе',
              q3: 'Сделал паузу',
              q4: 'Спокойствия',
            },
            initialResult: null,
            userQuestion: 'Новый вопрос в Коде',
          })
        )
      );
    });

    const startBtn = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Войти через образы'));
    expect(startBtn).toBeTruthy();
    await act(async () => {
      startBtn!.click();
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe('Мой уже отредактированный ответ в Мифе');
  });

  it('includes userQuestion in Meeting cache key and Meeting prompt as the person’s own words', () => {
    const calc = calculateDigitalCode('14.08.1991');
    const firstMirror = generateFirstMirror(calc);
    const storyInputs = { q1: 'Развилка в работе', q2: 'Мост', q3: 'Записал план', q4: 'Опоры' };
    const storyResult = { title: 'Мост', mirror: {} };

    const keyWithoutQuestion = deriveMeetingCacheKey({ calc, firstMirror }, { storyInputs, storyResult });
    const keyWithQuestionA = deriveMeetingCacheKey(
      { calc, firstMirror },
      { storyInputs, storyResult, userQuestion: 'Вопрос А' }
    );
    const keyWithQuestionB = deriveMeetingCacheKey(
      { calc, firstMirror },
      { storyInputs, storyResult, userQuestion: 'Вопрос Б' }
    );

    expect(keyWithoutQuestion).not.toBe(keyWithQuestionA);
    expect(keyWithQuestionA).not.toBe(keyWithQuestionB);

    const prompt = buildMeetingOfMirrorsPrompt(
      { calc, firstMirror },
      { storyInputs, storyResult, userQuestion: 'Как сохранить свои границы в новом проекте?' }
    );
    expect(prompt).toContain('Ваш прямой личный вопрос (ваши собственные слова с экрана Кода, НЕ сгенерированный системой вопрос): "Как сохранить свои границы в новом проекте?"');
    expect(prompt).toContain('Что вы рассказали');
    expect(prompt).toContain('Какой новый ракурс можно проверить');
    expect(prompt).toContain('На какую конкретную деталь опереться');
  });

  it('disables Telegram continuation in local candidate mode with the exact explanatory message', async () => {
    process.env.STAGE1_LOCAL_CANDIDATE_MODE = 'true';

    await expect(
      createContinuationClaim({
        journeyId: 'test-journey',
        sourceStage: 'meeting',
      } as any)
    ).rejects.toThrow('telegram_destination_unavailable');
    expect(LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE).toBe(
      'В этой тестовой версии продолжение в Telegram недоступно. Можно продолжить разговор здесь'
    );

    const calc = calculateDigitalCode('14.08.1991');
    await act(async () => {
      root.render(
        React.createElement(
          ConsentBoundary,
          null,
          React.createElement(TelegramContinuation, {
            codeResult: calc,
            storyResult: { title: 'Мост', story: 'Ты стоишь у моста.', mirror: {} },
            meetingResult: {
              summary: 'Что вы рассказали.',
              hasStrongParallels: true,
              confidenceNote: 'Связь',
              possibleSupport: 'Опора.',
              parallels: [],
              divergences: [],
              albertInsight: 'Ракурс.',
              reflectiveQuestion: 'Вопрос?',
              disclaimer: 'Дисклеймер',
            },
            journeyId: 'test-journey',
          } as any)
        )
      );
    });

    expect(container.textContent).toContain(
      'В этой тестовой версии продолжение в Telegram недоступно. Можно продолжить разговор здесь'
    );
    expect(container.innerHTML).not.toContain('digitalcodesystem_bot');
  });
});
