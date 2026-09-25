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
import { containsMeetingCrisisInput, deriveMeetingCacheKey } from '../server/meeting';
import { createContinuationClaim, LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE } from '../server/handoff';
import { buildCanonicalEnvelopeFromWebContext } from '../server/albert';
import {
  buildPersonalMythRepairPrompt,
  containsCrisisLanguage,
  containsCrisisLanguageText,
  SAFE_CRISIS_MESSAGE,
  validatePersonalMythResult,
} from '../server/myth';
import { parseMeetingResponse } from './services/meetingContract';
import { FORBIDDEN_ANALYTICS_KEYS, logDecisionEvent, validateAnalyticsEvent } from '../server/analytics';
import { MeetingOfMirrors } from './components/MeetingOfMirrors';
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

  it('Item 1: preserves quotes about another person without mechanical replacement, while rejecting third-person user discussion and broken pronoun agreement', () => {
    const validWithQuoteAndColleague = {
      status: 'ok',
      result: {
        summary:
          'В вашем вопросе звучит усталость от ночных переделок, когда рядом всплывает мысль: «Другой человек на этой должности давно бы сдал проект как есть». В выбранном вами образе комната с плотными шторами задаёт тихую дистанцию.',
        hasStrongParallels: true,
        confidenceNote: 'Высокий резонанс между вашим вопросом и гипотезой Кода.',
        possibleSupport:
          'В выбранном вами образе есть короткая пауза перед тем, как открыть папку; можно проверить, пригодится ли похожая пауза в рабочей ситуации, когда коллега приносит сырую задачу.',
        parallels: [
          {
            theme: 'Момент перед включением в чужую правку',
            codeAnchor: 'Интерпретация вашего Кода предлагает проверить, как вы держите границу качества.',
            mythAnchor: 'В вашем ответе вы назвали паузу перед началом работы.',
            synthesis: 'Для вашей ситуации это подсвечивает выбор между немедленным подхватом и короткой проверкой условий.',
          },
        ],
        divergences: [
          {
            theme: 'Темп реакции',
            codeAspect: 'Гипотеза Кода указывает на быстрый отклик.',
            mythAspect: 'В вашем ответе звучит потребность в тишине.',
            reflection: 'Вы можете заметить, в какой момент чужая спешка становится вашей задачей.',
          },
        ],
        albertInsight:
          'В вашей рабочей ситуации можно различить два хода: сразу забрать сырой черновик в ночную доработку или сначала вернуть автору один конкретный вопрос по критериям готовности.',
        reflectiveQuestion: 'По какому первому признаку в разговоре вы замечаете, что готовы забрать чужую недоработку на ночь?',
        disclaimer: 'Код и Миф — два независимых взгляда для саморефлексии.',
      },
    };

    const parsed = parseMeetingResponse(validWithQuoteAndColleague);
    expect(parsed.result?.summary).toContain('«Другой человек на этой должности давно бы сдал проект как есть»');
    expect(parsed.result?.summary).not.toContain('Другой вы');

    // Third-person discussion of the user himself must be rejected
    expect(() =>
      parseMeetingResponse({
        ...validWithQuoteAndColleague,
        result: {
          ...validWithQuoteAndColleague.result,
          summary: 'Пользователь описывает рабочую перегрузку и ночные переделки за команду.',
        },
      })
    ).toThrow('meeting_third_person_about_user');

    // Broken single-word pronoun substitution («вы описывает», «в ответах вас») must be rejected
    expect(() =>
      parseMeetingResponse({
        ...validWithQuoteAndColleague,
        result: {
          ...validWithQuoteAndColleague.result,
          summary: 'В ответах вас видна усталость, когда вы описывает ночные переделки.',
        },
      })
    ).toThrow('meeting_third_person_about_user');
  });

  it('Item 1: rejects unprompted crack AND cosmetic борозда/скол substitutions in PersonalMyth when user did not introduce damage, while allowing user-supplied crack imagery', () => {
    const baseParagraphs = [
      'Ты выходишь к старому каменному мосту на рассвете, когда утренний туман ещё держится у самой воды и свежий воздух пахнет речной прохладой. Под ладонью ты чувствуешь прохладный серый гранит парапета, а внизу спокойно и ровно расходится глубокое течение реки.',
      'В руке у тебя тяжёлый черновик рабочего плана: ты кладёшь его на широкий каменный выступ и внимательно смотришь, как вода без суеты обходит массивные опоры моста. Два списка задач лежат рядом, и ты видишь, как ветер слегка приподнимает углы исписанных страниц.',
      'Ты делаешь глубокий спокойный вдох, аккуратно убираешь лишние листы в сумку и оставляешь перед собой только один чистый разворот. Течение внизу остаётся ровным, и твой шаг по мосту звучит отчётливо и уверенно в утренней тишине.',
    ];
    const baseResult: any = {
      title: 'Мост над тихой водой',
      story: baseParagraphs.join('\n\n'),
      mirror: {
        mainImage: 'В вашем ответе каменный мост и разворот черновика задают спокойную точку опоры.',
        innerTension: 'В вашем ответе рядом стоят спешка и потребность в ясном ритме.',
        hiddenResource: 'В сцене стало возможно убрать лишние листы и оставить один конкретный шаг.',
        newView: 'Вы можете проверить, как меняется темп, когда вы выбираете один разворот.',
      },
      meaning: ['В вашей ситуации пауза помогает удержать фокус.'],
      one_step: 'Сегодня выберите один рабочий лист и отложите остальные на десять минут.',
      journal_question: 'Что меняется в вашем внимании, когда перед вами остаётся только одна задача?',
      disclaimer: 'Образный формат для саморефлексии.',
    };

    const requestWithoutDamage = {
      request_id: 'req-no-damage-1234',
      consent_version: 'u1-consent.v1',
      answers: {
        q1: 'Выбираю между двумя проектами и хочу сохранить рабочий ритм.',
        q2: 'Каменный мост и рабочий блокнот на парапете.',
        q3: 'Когда оставляю на столе только один лист.',
        q4: 'Спокойной собранности.',
      },
    };

    // 1. Unprompted «борозда» (cosmetic substitute for «трещина») must fail with unprompted_crack_cliche
    const withUnpromptedBorozda = {
      ...baseResult,
      story: baseResult.story.replace('прохладный серый гранит', 'глубокую борозду на камне'),
    };
    const borozdaCheck = validatePersonalMythResult(withUnpromptedBorozda, requestWithoutDamage);
    expect(borozdaCheck.passed).toBe(false);
    expect(borozdaCheck.blockers).toContain('unprompted_crack_cliche');

    // 2. buildPersonalMythRepairPrompt must pass untouched draft text (preserving «трещина») and forbid «борозда/скол»
    const withUnpromptedCrack = {
      ...baseResult,
      story: baseResult.story.replace('прохладный серый гранит', 'глубокую трещину на камне'),
    };
    const repairPrompt = buildPersonalMythRepairPrompt(
      requestWithoutDamage,
      withUnpromptedCrack.story,
      withUnpromptedCrack.mirror,
      ['unprompted_crack_cliche'],
      withUnpromptedCrack
    );
    expect(repairPrompt).toContain('глубокую трещину на камне');
    expect(repairPrompt).toContain('Не заменяй слово «трещина» косметическими синонимами («борозда», «скол»');

    // 3. When the user explicitly introduces «трещина» in q2, crack imagery IS allowed
    const requestWithUserCrack = {
      ...requestWithoutDamage,
      answers: {
        ...requestWithoutDamage.answers,
        q2: 'Старая чашка с тонкой трещиной на краю.',
      },
    };
    const allowedCheck = validatePersonalMythResult(withUnpromptedCrack, requestWithUserCrack);
    expect(allowedCheck.blockers).not.toContain('unprompted_crack_cliche');
  });

  it('Item 2: enforces strict source separation in MeetingOfMirrors for the courier/folder scenario', () => {
    const courierStoryData = {
      userQuestion: 'Срываюсь на команду при горящих сроках, а потом сам переделываю всё ночью',
      storyInputs: {
        q1: 'Срываюсь на команду при горящих сроках, а потом сам переделываю всё ночью',
        q2: 'Комната с плотными шторами и стопка чертежей под лампой',
        q3: 'Когда закрываю дверь изнутри и молча забираю папку у курьера',
        q4: 'Спокойной паузы перед решением',
      },
      storyResult: {
        title: 'Лампа над чертежами',
        story: 'Ты закрываешь дверь изнутри и кладёшь папку курьера на край стола под тёплый свет лампы.',
      },
    };

    const baseCourierEnvelope = {
      status: 'ok',
      result: {
        summary:
          'В вашем вопросе речь идёт о реальной рабочей перегрузке — срывах при горящих сроках и ночных переделках за команду. В выбранном вами образе (q2–q3) этому противопоставлена закрытая дверь, стол под лампой и пауза перед тем, как открыть папку.',
        hasStrongParallels: true,
        confidenceNote: 'Сопоставление реального рабочего вопроса и выбранного вами образа дистанции.',
        possibleSupport:
          'В выбранном вами образе есть пауза перед тем, как открыть папку курьера; можно проверить, пригодится ли похожая двухминутная пауза в рабочей ситуации, прежде чем забирать сырую задачу на ночь.',
        parallels: [
          {
            theme: 'Граница между приёмом задачи и немедленной переделкой',
            codeAnchor: 'Интерпретация вашего Кода предлагает проверить, как вы распределяете ответственность за результат.',
            mythAnchor: 'В выбранном вами образе вы сначала кладёте папку на край стола, не открывая её сразу.',
            synthesis: 'Для вашей рабочей ситуации это ставит вопрос: можно ли разделить момент получения черновика и решение переделывать его самому ночью.',
          },
        ],
        divergences: [
          {
            theme: 'Режим уединения в образе и командный процесс в жизни',
            codeAspect: 'Гипотеза Кода опирается на прямой контакт и ясные условия в диалоге.',
            mythAspect: 'В вашем образе покой появляется только за закрытой изнутри дверью.',
            reflection: 'В реальной работе с командой нельзя просто закрыть дверь, но можно проверить короткую паузу перед ответом.',
          },
        ],
        albertInsight:
          'В вашей ситуации со сроками можно различить два способа действовать: сразу на эмоциях забрать сырой материал и переписать его ночью самому — или в момент приёма назвать один конкретный критерий, без которого задача не принимается в работу.',
        reflectiveQuestion: 'Какой один вопрос к автору черновика вы можете задать до того, как возьмёте задачу в ночную доработку?',
        disclaimer: 'Код и Миф — два независимых взгляда.',
      },
    };

    // Properly attributed image hypothesis passes
    const valid = parseMeetingResponse(baseCourierEnvelope, courierStoryData);
    expect(valid.status).toBe('ok');
    expect(valid.result?.possibleSupport).toContain('В выбранном вами образе есть пауза');

    // Conflating the imaginary courier/folder action with already-practiced real-life behavior must fail
    expect(() =>
      parseMeetingResponse(
        {
          status: 'ok',
          result: {
            ...baseCourierEnvelope.result,
            possibleSupport:
              'Вы уже умеете выдерживать границу — как вы это делаете, когда молча забираете папку у курьера и закрываете дверь изнутри; это уже испытанный вами способ.',
          },
        },
        courierStoryData
      )
    ).toThrow(/meeting_unsupported_support_claim|meeting_source_conflation/);

    // Promising an ungrounded outcome («ночная переделка становится менее неизбежной») must fail
    expect(() =>
      parseMeetingResponse(
        {
          status: 'ok',
          result: {
            ...baseCourierEnvelope.result,
            albertInsight:
              'Если вы перенесёте этот жест с папкой в рабочий день, ночная переделка становится менее неизбежной и конфликты исчезнут.',
          },
        },
        courierStoryData
      )
    ).toThrow(/meeting_unsupported_support_claim|meeting_source_conflation/);
  });

  it('Owner Addition 1: detects direct crisis language while ignoring quotes, negations, and work metaphors, and renders crisis state calmly in MeetingOfMirrors', async () => {
    // 1. Direct crisis / self-harm intent -> true
    expect(containsCrisisLanguageText('Я больше не хочу жить, думаю покончить с собой сегодня вечером')).toBe(true);
    expect(
      containsMeetingCrisisInput(
        {
          storyInputs: { q1: 'Устал от работы', q2: 'Стол', q3: 'Пауза', q4: 'Покой' },
        },
        'Хочу причинить себе вред и уйти из жизни'
      )
    ).toBe(true);

    // 2. Quote -> false
    expect(
      containsCrisisLanguageText(
        'Коллега на встрече процитировал фразу из книги: «не хочу жить в таком графике», но мы спокойно пересобрали план'
      )
    ).toBe(false);

    // 3. Explicit negation -> false
    expect(
      containsCrisisLanguageText(
        'Я точно не собираюсь причинять себе вред и не хочу умирать, мне важно просто выспаться и сменить ритм'
      )
    ).toBe(false);

    // 4. Colloquial work metaphor -> false
    expect(
      containsCrisisLanguageText(
        'На работе просто убивают этими правками, старый проект умер, я выгорел в ноль на созвонах, брать ещё один релиз — это профессиональное самоубийство'
      )
    ).toBe(false);
    expect(
      containsMeetingCrisisInput(
        {
          storyInputs: {
            q1: 'На работе просто убивают этими правками, проект умер',
            q2: 'Выгорел в ноль на созвонах',
            q3: 'Сделал паузу',
            q4: 'Ясности',
          },
        },
        'Брать второй проект без людей — это профессиональное самоубийство'
      )
    ).toBe(false);

    // 5. UI rendering of status === 'crisis' in MeetingOfMirrors
    const calc = calculateDigitalCode('14.08.1991');
    const firstMirror = generateFirstMirror(calc);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/meeting-of-mirrors')) {
          return new Response(
            JSON.stringify({
              status: 'crisis',
              ui: { safe_message: SAFE_CRISIS_MESSAGE },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ accepted: true }), { status: 200 });
      })
    );

    await act(async () => {
      root.render(
        React.createElement(
          ConsentBoundary,
          null,
          React.createElement(MeetingOfMirrors, {
            codeDate: '14.08.1991',
            userQuestion: 'Тяжёлый момент',
            codeResult: calc,
            firstMirror,
            storyInputs: { q1: 'Ситуация', q2: 'Мост', q3: 'Шаг', q4: 'Покой' },
            storyResult: {
              title: 'Мост',
              story: 'Ты стоишь у моста.',
              mirror: { mainImage: 'Мост', innerTension: 'Вопрос', hiddenResource: 'Шаг', newView: 'Взгляд' },
              meaning: ['Смысл'],
              one_step: 'Шаг',
              journal_question: 'Вопрос?',
              disclaimer: 'Дисклеймер',
            },
            onOpenCode: () => {},
            onOpenMyth: () => {},
          })
        )
      );
    });

    const runBtn = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Провести Встречу зеркал'));
    expect(runBtn).toBeTruthy();
    await act(async () => {
      runBtn!.click();
    });

    const crisisSupportBox = container.querySelector('[data-testid="meeting-crisis-support"]');
    expect(crisisSupportBox).toBeTruthy();
    expect(crisisSupportBox?.textContent).toContain(SAFE_CRISIS_MESSAGE);
    expect(container.textContent).not.toContain('Сопоставляем отражения...');
  });

  it('Owner Addition 2: forbids userQuestion and user_question in analytics events (top-level and nested) without enabling analytics', async () => {
    expect(FORBIDDEN_ANALYTICS_KEYS).toContain('userQuestion');
    expect(FORBIDDEN_ANALYTICS_KEYS).toContain('user_question');
    expect(FORBIDDEN_ANALYTICS_KEYS).toContain('q5');

    expect(
      validateAnalyticsEvent({
        event_name: 'code_calculated',
        userQuestion: 'Секретный личный вопрос',
      })
    ).toEqual({ valid: false, error: 'forbidden_sensitive_key_detected:userQuestion' });

    expect(
      validateAnalyticsEvent({
        event_name: 'meeting_completed',
        payload: {
          nested: [{ user_question: 'Секретный личный вопрос' }],
        },
      })
    ).toEqual({ valid: false, error: 'forbidden_sensitive_key_detected:user_question' });

    await expect(
      logDecisionEvent({
        event_name: 'code_calculated',
        timestamp: new Date().toISOString(),
        anonymous_id: 'anon_123',
        session_id: 'sess_123',
        funnel_version: 'v1',
        userQuestion: 'Не должен попасть в лог',
      } as any)
    ).resolves.toBe(false);
  });

  it('V5 Defect 1: accurately distinguishes q3 real experience, q3 imaginative scene, q3 unknown resource, q4 wish, colleague quote, and Myth-only details', () => {
    const baseMeetingEnvelope = {
      status: 'ok',
      result: {
        summary: 'В вашем вопросе вы описываете рабочее напряжение вокруг сроков.',
        hasStrongParallels: true,
        confidenceNote: 'Сопоставление ответов и гипотезы Кода.',
        possibleSupport: 'Можно проверить короткую паузу перед ответом.',
        parallels: [
          {
            theme: 'Ритм включения',
            codeAnchor: 'Гипотеза Кода предлагает проверить границу ответственности.',
            mythAnchor: 'В вашем ответе звучит внимание к паузе.',
            synthesis: 'Для вашей ситуации это открывает выбор темпа.',
          },
        ],
        divergences: [],
        albertInsight: 'В вашей ситуации можно различить немедленный подхват задачи и предварительное согласование рамок.',
        reflectiveQuestion: 'Какой один признак подскажет вам, что задачу стоит уточнить до начала работы?',
        disclaimer: 'Код и Миф — два независимых взгляда.',
      },
    };

    // 1. Real action in q3 -> allowed to retell as user's own reported real experience
    const realQ3Context = {
      userQuestion: 'Перегружаюсь на общих созвонах',
      storyInputs: {
        q1: 'На общих созвонах беру лишние задачи',
        q2: 'Тяжёлый портфель',
        q3: 'На работе по утрам спокойно разбираю сложные сметы один на один с ведущим инженером',
        q4: 'Спокойного делегирования',
      },
      storyResult: {
        title: 'Утренний стол',
        story: 'Ты открываешь папку и смотришь на цифры.',
      },
    };
    const validRealQ3 = parseMeetingResponse(
      {
        status: 'ok',
        result: {
          ...baseMeetingEnvelope.result,
          possibleSupport:
            'Вы рассказали, что на работе по утрам спокойно разбираете сложные сметы один на один с ведущим инженером; можно проверить, как перенести этот формат короткого разбора один на один перед общим созвоном.',
        },
      },
      realQ3Context,
    );
    expect(validRealQ3.status).toBe('ok');

    // 2. Imaginative scene in q3 -> rejected as already-tested real behavior, allowed when labeled as image
    const imageQ3Context = {
      userQuestion: 'Срываюсь при горящих сроках',
      storyInputs: {
        q1: 'Срываюсь при горящих сроках',
        q2: 'Комната с плотными шторами',
        q3: 'Когда на вершине маяка в шторм закрываю тяжёлую дверь и забираю папку у курьера',
        q4: 'Спокойствия',
      },
      storyResult: { title: 'Маяк', story: 'Ты стоишь у двери маяка.' },
    };
    expect(() =>
      parseMeetingResponse(
        {
          status: 'ok',
          result: {
            ...baseMeetingEnvelope.result,
            possibleSupport:
              'Возможно опереться на то, как вы это делаете, когда забираете папку у курьера на маяке — это уже испытанный вами способ.',
          },
        },
        imageQ3Context,
      ),
    ).toThrow(/meeting_source_conflation|meeting_unsupported_support_claim/);

    // 3. Unknown resource in q3 -> rejected if claiming tested support already exists, allowed when acknowledging unknown resource
    const unknownQ3Context = {
      userQuestion: 'Теряю фокус при авралах',
      storyInputs: {
        q1: 'Теряю фокус при авралах',
        q2: 'Шумный перекрёсток',
        q3: 'Не знаю, ничего конкретного не вспоминается',
        q4: 'Тишины на полчаса',
      },
      storyResult: { title: 'Перекрёсток', story: 'Ты останавливаешься у края дороги.' },
    };
    expect(() =>
      parseMeetingResponse(
        {
          status: 'ok',
          result: {
            ...baseMeetingEnvelope.result,
            possibleSupport:
              'Возможно опереться на уже испытанный вами способ удерживать фокус, как вы уже делаете в работе.',
          },
        },
        unknownQ3Context,
      ),
    ).toThrow(/meeting_source_conflation|meeting_unsupported_support_claim/);

    const validUnknownQ3 = parseMeetingResponse(
      {
        status: 'ok',
        result: {
          ...baseMeetingEnvelope.result,
          possibleSupport:
            'Пока в вашем ответе не видно уже испытанной опоры в реальной ситуации, но в качестве желаемого направления вы назвали полчаса тишины — можно проверить одну короткую паузу перед ответом.',
        },
      },
      unknownQ3Context,
    );
    expect(validUnknownQ3.status).toBe('ok');

    // 4. Wish in q4 -> rejected if desired direction in q4 is turned into an already mastered ability
    expect(() =>
      parseMeetingResponse(
        {
          status: 'ok',
          result: {
            ...baseMeetingEnvelope.result,
            possibleSupport:
              'Возможно опереться на то, что вы уже умеете спокойно делегировать задачи — это ваш освоенный навык.',
          },
        },
        realQ3Context,
      ),
    ).toThrow(/meeting_source_conflation|meeting_unsupported_support_claim/);

    // 5. Colleague quote/action -> rejected if colleague's action is attributed to the user
    const colleagueContext = {
      userQuestion: 'Коллега на планерке кричит: «я бросаю проект и увольняюсь», а я молча доделываю отчёт',
      storyInputs: {
        q1: 'Коллега на планерке кричит: «я бросаю проект и увольняюсь», а я молча доделываю отчёт',
        q2: 'Стол с бумагами',
        q3: 'На работе спокойно сверяю цифры в таблице',
        q4: 'Ясных границ',
      },
      storyResult: { title: 'Отчёт', story: 'Ты закрываешь таблицу.' },
    };
    expect(() =>
      parseMeetingResponse(
        {
          status: 'ok',
          result: {
            ...baseMeetingEnvelope.result,
            summary: 'В вашей рабочей ситуации вы кричите на планерке и бросаете проект.',
          },
        },
        colleagueContext,
      ),
    ).toThrow('meeting_source_conflation');

    const validColleague = parseMeetingResponse(
      {
        status: 'ok',
        result: {
          ...baseMeetingEnvelope.result,
          summary:
            'В вашем вопросе вы описали ситуацию, где коллега на планерке кричит о желании бросить проект, а вы молча доделываете отчёт.',
        },
      },
      colleagueContext,
    );
    expect(validColleague.status).toBe('ok');

    // 6. Detail appearing ONLY in Myth -> rejected if attributed to user's own answer, allowed when attributed to Myth text
    const mythOnlyDetailContext = {
      userQuestion: 'Трудно выбрать приоритет',
      storyInputs: {
        q1: 'Трудно выбрать приоритет между двумя задачами',
        q2: 'Деревянный стол',
        q3: 'В жизни утром выписываю три главных пункта на лист',
        q4: 'Ясности',
      },
      storyResult: {
        title: 'Медный компас',
        story: 'На подоконнике ты находишь старинный медный компас с тяжёлой стрелкой.',
      },
    };
    expect(() =>
      parseMeetingResponse(
        {
          status: 'ok',
          result: {
            ...baseMeetingEnvelope.result,
            summary: 'В вашем ответе вы назвали старинный медный компас со стрелкой на подоконнике.',
          },
        },
        mythOnlyDetailContext,
      ),
    ).toThrow('meeting_source_conflation');

    const validMythDetail = parseMeetingResponse(
      {
        status: 'ok',
        result: {
          ...baseMeetingEnvelope.result,
          summary:
            'В тексте Мифа появляется образ старинного медного компаса, а в вашем ответе о реальном опыте вы назвали утренний список из трёх пунктов.',
        },
      },
      mythOnlyDetailContext,
    );
    expect(validMythDetail.status).toBe('ok');
  });

  it('V5 Defect 2: intercepts self-quotation and mixed external-quote + self-danger inputs while ignoring third-party artistic quotes, negations, and metaphors', () => {
    // Exact V5 architectural matrix
    expect(containsCrisisLanguageText('Я хочу умереть')).toBe(true);
    expect(containsCrisisLanguageText('Я сейчас думаю: «хочу умереть». Это про меня.')).toBe(true);
    expect(containsCrisisLanguageText('В романе герой говорит: «хочу умереть».')).toBe(false);
    expect(containsCrisisLanguageText('Я не хочу умереть')).toBe(false);
    expect(containsCrisisLanguageText('Это профессиональное самоубийство')).toBe(false);

    // Additional self-quoting and combined external quote + self-danger cases
    expect(containsCrisisLanguageText('Я говорю себе: «не хочу больше жить».')).toBe(true);
    expect(containsCrisisLanguageText('В романе герой говорит: «хочу умереть», и это про меня.')).toBe(true);
    expect(
      containsCrisisLanguageText('В романе герой говорит: «хочу умереть», а я сегодня решил покончить с собой.'),
    ).toBe(true);
    expect(
      containsMeetingCrisisInput(
        { storyInputs: { q1: 'Тяжёлая неделя', q2: 'Стол', q3: 'Пауза', q4: 'Тишина' } },
        'Я сейчас думаю: «хочу умереть». Это про меня.',
      ),
    ).toBe(true);
  });
});
