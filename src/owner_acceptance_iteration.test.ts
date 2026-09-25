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
import { buildCanonicalEnvelopeFromWebContext } from '../server/albert';
import { validatePersonalMythResult } from '../server/myth';
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

  it('allows the user to clear pre-filled q1 in PersonalMyth without useEffect snapping it back to userQuestion', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          ConsentBoundary,
          null,
          React.createElement(PersonalMyth, {
            initialInputs: null,
            initialResult: null,
            userQuestion: 'Исходный вопрос из Кода',
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
    expect(textarea.value).toBe('Исходный вопрос из Кода');

    // Simulate user clearing q1 (which updates initialInputs.q1 to '' in parent App.tsx while userQuestion remains set)
    await act(async () => {
      root.render(
        React.createElement(
          ConsentBoundary,
          null,
          React.createElement(PersonalMyth, {
            initialInputs: { q1: '', q2: '', q3: '', q4: '' },
            initialResult: null,
            userQuestion: 'Исходный вопрос из Кода',
          })
        )
      );
    });

    const updatedTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(updatedTextarea).toBeTruthy();
    expect(updatedTextarea.value).toBe('');
  });

  it('records rejected codeReactions («Не похоже») so they are never forwarded as uncontested facts to Albert or Meeting of Mirrors', () => {
    const calc = calculateDigitalCode('14.08.1991');
    const firstMirror = generateFirstMirror(calc);
    const codeV2Payload: any = {
      central_motif: 'Гипотеза о внутреннем контрасте 5 и 6',
      synthesis: { strongest_motif: 'Гипотеза о внутреннем контрасте 5 и 6' },
      positions: [
        { position: 'soul', public_name: 'Число Души', role: 'Внутренний запрос', energy: 5, essence: 'Поиск точной связи и смысла.' },
        { position: 'path', public_name: 'Число Пути', role: 'Способ действия', energy: 6, essence: 'Забота о качестве и ритме.' },
      ],
    };

    const envelope = buildCanonicalEnvelopeFromWebContext({
      userQuestion: 'Как не выгорать от чужих задач?',
      codeAnchors: { numbers: calc },
      codeV2Payload,
      codeReactions: {
        central_motif: 'rejected',
        soul: 'confirmed',
      },
    } as any);

    // Rejected central_motif must NOT be emitted as a code_interpretation claim
    const centralMotifInterpretation = envelope.evidence.find(
      (item: any) => item.source === 'code_interpretation' && item.source_ref === 'code.central_motif'
    );
    expect(centralMotifInterpretation).toBeUndefined();

    // Instead, an explicit user_statement correction is recorded
    const centralMotifRejection = envelope.evidence.find(
      (item: any) => item.source === 'user_statement' && item.source_ref === 'user.reaction.central_motif'
    );
    expect(centralMotifRejection).toBeDefined();
    expect(centralMotifRejection.claim_summary).toContain('Отмечено «Не похоже»');
    expect(envelope.memory_summary.salient_user_statements.some((s: string) => s.includes('Отмечено «Не похоже»'))).toBe(true);

    // Meeting prompt and cache key also reflect codeReactions
    const storyInputs = { q1: 'Вопрос о границах', q2: 'Стол', q3: 'Сказал нет', q4: 'Тишины' };
    const storyResult = { title: 'Стол у окна', mirror: {} };
    const key1 = deriveMeetingCacheKey({ calc, firstMirror, codeV2Payload, codeReactions: { central_motif: 'rejected' } }, { storyInputs, storyResult });
    const key2 = deriveMeetingCacheKey({ calc, firstMirror, codeV2Payload, codeReactions: { central_motif: 'confirmed' } }, { storyInputs, storyResult });
    expect(key1).not.toBe(key2);

    const meetingPrompt = buildMeetingOfMirrorsPrompt(
      { calc, firstMirror, codeV2Payload, codeReactions: { central_motif: 'rejected', soul: 'confirmed' } },
      { storyInputs, storyResult }
    );
    expect(meetingPrompt).toContain('ВАША ПРАВКА К КОДУ («Не похоже»): вы прямо отметили несогласие по блокам [central_motif]');
    expect(meetingPrompt).toContain('ОТКЛОНЕНО ВАМИ КАК «НЕ ПОХОЖЕ» — НЕ ИСПОЛЬЗОВАТЬ КАК ФАКТ');
  });

  it('validates PersonalMyth direct vy register across the full mirror object even when mainImage has no pronoun', () => {
    const validMythResult: any = {
      title: 'Мост над тихой водой',
      story: [
        'Ты выходишь к старому каменному мосту на рассвете, когда утренний туман ещё держится у самой воды и свежий воздух пахнет речной прохладой. Под ладонью ты чувствуешь прохладный серый гранит парапета, а внизу спокойно и ровно расходится глубокое течение реки.',
        'В руке у тебя тяжёлый черновик рабочего плана: ты кладёшь его на широкий каменный выступ и внимательно смотришь, как вода без суеты обходит массивные опоры моста. Два списка задач лежат рядом, и ты видишь, как ветер слегка приподнимает углы исписанных страниц.',
        'Ты делаешь глубокий спокойный вдох, аккуратно убираешь лишние листы в сумку и оставляешь перед собой только один чистый разворот. Течение внизу остаётся ровным, и твой шаг по мосту звучит отчётливо и уверенно в утренней тишине.',
      ].join('\n\n'),
      mirror: {
        mainImage: 'Каменный мост и чистый разворот черновика на парапете как точка устойчивого выбора.',
        innerTension: 'В вашем ответе рядом стоят желание сразу закрыть оба направления и потребность сначала опереться на один ясный ритм.',
        hiddenResource: 'Ваша опора проявляется в момент, когда вы убираете лишние листы и оставляете один конкретный шаг.',
        newView: 'Вы можете проверить, что меняется, когда решение принимается из спокойного темпа, а не из спешки.',
      },
      meaning: [
        'В вашей ситуации пауза перед выбором помогает отделить срочное от действительно важного.',
        'Когда вы опираетесь на один шаг, возвращается ясность.',
      ],
      one_step: 'Сегодня выберите один рабочий вопрос и запишите по нему одно конкретное решение.',
      journal_question: 'По какому признаку вы заметите, что выбранный шаг возвращает вам спокойствие?',
      disclaimer: 'Личный миф — это метафорическое отражение ваших ответов.',
    };

    const validation = validatePersonalMythResult(validMythResult, {
      request_id: 'test-req-1',
      consent_version: 'u1-consent.v1',
      answers: {
        q1: 'Выбираю между двумя рабочими направлениями и хочу сохранить ясный ритм.',
        q2: 'Каменный мост над водой и черновик на парапете.',
        q3: 'Когда убираю лишние листы и оставляю один разворот.',
        q4: 'Спокойного темпа и точного выбора.',
      },
    });
    expect(validation.blockers).not.toContain('register_formal_you_forbidden');
    expect(validation.blockers).not.toContain('post_story_third_person_forbidden');
  });
});
