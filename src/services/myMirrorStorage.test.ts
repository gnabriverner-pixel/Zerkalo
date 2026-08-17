import { describe, it, expect, beforeEach } from 'vitest';
import {
  MY_MIRROR_STORAGE_KEY,
  MyMirrorSnapshotV1,
  SaveMyMirrorInput,
  saveMyMirrorSnapshot,
  loadMyMirrorSnapshot,
  deleteMyMirrorSnapshot,
  hasMyMirrorSnapshot,
  isValidMyMirrorSnapshotV1
} from './myMirrorStorage';

const mockValidInput: SaveMyMirrorInput = {
  codeDate: '15.08.1990',
  codeResult: {
    soul: 6,
    soulComposite: '15/6',
    path: 33,
    pathComposite: '33',
    direction: 3,
    directionComposite: '39/12/3',
    expression: 5,
    expressionComposite: '23/5',
    result: 6,
    resultComposite: '6',
    baseMatrix: { '1': 2, '5': 1 },
    detailedMatrix: { '1': 2, '5': 1, '8': 1 }
  },
  firstMirror: {
    title: 'Ваш цифровой код собран',
    subtitle: 'Архитектурный разбор матрицы',
    formula: {
      numbers: '6 / 5 / 33 / 3 / 6',
      planets: 'Венера / Меркурий / Учитель / Юпитер / Венера',
      positions: 'Душа / Выражение / Путь / Направление / Результат'
    },
    blocks: [
      { id: 'main_pattern', title: 'Главный узор', text: 'Ядро матрицы опирается на связку 6 и 33' },
      { id: 'strength', title: 'Опора и сила', text: 'Способность видеть целое' },
      { id: 'tension', title: 'Зона напряжения', text: 'Стремление контролировать неконтролируемое' }
    ],
    keyInsight: 'Главная тема этой архитектуры — не масштаб ради масштаба',
    strengthTags: ['Глубина', 'Эстетика'],
    tensionTags: ['Перфекционизм'],
    practicalStep: 'Оставить одно решение без немедленного контроля',
    cta: {
      title: 'Переход',
      text: 'Исследуйте зеркала',
      button: 'Продолжить'
    },
    disclaimer: 'Расчет носит ориентировочный характер'
  },
  storyInputs: {
    q1: 'поиск баланса',
    q2: 'маяк на скалистом берегу',
    q3: 'тишина перед грозой',
    q4: 'спокойная глубина'
  },
  storyResult: {
    title: 'Хранитель маяка',
    story: 'История о поиске внутренней тишины посреди бушующего моря...',
    mirror: {
      mainImage: 'Каменный маяк',
      innerTension: 'Шторм и тишина',
      hiddenResource: 'Непоколебимая ось',
      newView: 'Доверие стихии'
    },
    meaning: ['Опора внутри', 'Принятие перемен'],
    one_step: 'Сделать паузу перед реакцией',
    journal_question: 'Что удерживает свет, когда море волнуется?',
    disclaimer: 'Миф создан метафорически'
  },
  meetingResult: {
    summary: 'Встреча двух линз выявляет устойчивую связь между структурой и образом.',
    hasStrongParallels: true,
    confidenceNote: 'Высокая согласованность',
    reflectiveQuestion: 'Какая опора позволяет удерживать равновесие?',
    albertInsight: 'Код фиксирует каркас, Миф дает дыхание.',
    disclaimer: 'Синтез носит исследовательский характер',
    parallels: [
      {
        theme: 'Удержание внутренней опоры',
        codeAnchor: 'Число Души 6 и Путь 33',
        mythAnchor: 'Образ маяка',
        synthesis: 'Оба зеркала сходятся на необходимости оси.'
      }
    ],
    divergences: [
      {
        theme: 'Динамика контроля',
        codeAspect: 'Стратегический контроль',
        mythAspect: 'Созерцательное отпускание',
        reflection: 'Две стороны единого процесса.'
      }
    ]
  },
  meetingUserNote: 'Мои личные заметки о встрече'
};

describe('MyMirror Storage Service (V0 Contract)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('1. save -> load valid V1 snapshot', () => {
    expect(hasMyMirrorSnapshot()).toBe(false);

    const saved = saveMyMirrorSnapshot(mockValidInput);
    expect(saved).toBe(true);
    expect(hasMyMirrorSnapshot()).toBe(true);

    const loaded = loadMyMirrorSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(typeof loaded?.savedAt).toBe('string');
    expect(loaded?.codeDate).toBe('15.08.1990');
    expect(loaded?.codeResult.soul).toBe(6);
    expect(loaded?.firstMirror.title).toBe('Ваш цифровой код собран');
    expect(loaded?.storyInputs.q1).toBe('поиск баланса');
    expect(loaded?.storyResult.title).toBe('Хранитель маяка');
    expect(loaded?.meetingResult.parallels).toHaveLength(1);
    expect(loaded?.meetingUserNote).toBe('Мои личные заметки о встрече');
  });

  it('2. clear removes snapshot', () => {
    saveMyMirrorSnapshot(mockValidInput);
    expect(hasMyMirrorSnapshot()).toBe(true);

    const deleted = deleteMyMirrorSnapshot();
    expect(deleted).toBe(true);
    expect(hasMyMirrorSnapshot()).toBe(false);
    expect(loadMyMirrorSnapshot()).toBeNull();
    expect(window.localStorage.getItem(MY_MIRROR_STORAGE_KEY)).toBeNull();
  });

  it('3. corrupt JSON fails closed gracefully', () => {
    window.localStorage.setItem(MY_MIRROR_STORAGE_KEY, '{ broken json ::: missing brackets');
    expect(loadMyMirrorSnapshot()).toBeNull();
    expect(hasMyMirrorSnapshot()).toBe(false);
  });

  it('4. wrong version fails closed', () => {
    const invalidVersion = {
      ...mockValidInput,
      version: 2,
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(MY_MIRROR_STORAGE_KEY, JSON.stringify(invalidVersion));
    expect(loadMyMirrorSnapshot()).toBeNull();
    expect(hasMyMirrorSnapshot()).toBe(false);
  });

  it('5. missing required fields fails closed', () => {
    // Missing meetingResult
    const missingMeeting = {
      version: 1,
      savedAt: new Date().toISOString(),
      codeDate: '15.08.1990',
      codeResult: mockValidInput.codeResult,
      firstMirror: mockValidInput.firstMirror,
      storyInputs: mockValidInput.storyInputs,
      storyResult: mockValidInput.storyResult
      // meetingResult missing
    };
    window.localStorage.setItem(MY_MIRROR_STORAGE_KEY, JSON.stringify(missingMeeting));
    expect(loadMyMirrorSnapshot()).toBeNull();
    expect(isValidMyMirrorSnapshotV1(missingMeeting)).toBe(false);

    // Missing storyInputs (answers required for inspectable provenance)
    const missingInputs = {
      ...missingMeeting,
      meetingResult: mockValidInput.meetingResult,
      storyInputs: undefined
    };
    window.localStorage.setItem(MY_MIRROR_STORAGE_KEY, JSON.stringify(missingInputs));
    expect(loadMyMirrorSnapshot()).toBeNull();
  });

  it('6. save never includes forbidden fields / secrets', () => {
    // Pass object with forbidden fields (e.g. apiKey, token, internalPrompt)
    const taintedInput: any = {
      ...mockValidInput,
      apiKey: 'sk-deepseek-forbidden-secret',
      secretToken: 'secret-auth-cookie',
      internalPrompt: 'SYSTEM INSTRUCTIONS...',
      serverTelemetry: { traceId: '123' }
    };

    saveMyMirrorSnapshot(taintedInput);

    const rawPersisted = window.localStorage.getItem(MY_MIRROR_STORAGE_KEY);
    expect(rawPersisted).not.toBeNull();
    const parsed = JSON.parse(rawPersisted!);

    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secretToken).toBeUndefined();
    expect(parsed.internalPrompt).toBeUndefined();
    expect(parsed.serverTelemetry).toBeUndefined();
    expect(parsed.version).toBe(1);
    expect(parsed.codeDate).toBe('15.08.1990');
  });
});
