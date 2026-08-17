import { describe, it, expect, beforeEach } from 'vitest';
import {
  MY_MIRROR_STORAGE_KEY,
  SaveMyMirrorInput,
  saveMyMirrorSnapshot,
  loadMyMirrorSnapshot,
  isSnapshotMatchingCurrentSession
} from './myMirrorStorage';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse, MeetingOfMirrorsResult } from '../types';

const sampleCalculationA: CalculationResult = {
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
};

const sampleFirstMirrorA: FirstMirror = {
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
};

const sampleMythA: NonNullable<ApiResponse['story_result']> = {
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
};

const sampleMeetingA: MeetingOfMirrorsResult = {
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
};

const sampleInputsA: StoryInputs = {
  q1: 'поиск баланса',
  q2: 'маяк на скалистом берегу',
  q3: 'тишина перед грозой',
  q4: 'спокойная глубина'
};

describe('Session Integrity & Invalidation Contract (Issue #20 Correction)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // State Transition Simulator for App.tsx
  class AppSessionState {
    codeDate = '15.08.1990';
    codeResult: CalculationResult | null = sampleCalculationA;
    firstMirror: FirstMirror | null = sampleFirstMirrorA;
    storyInputs: StoryInputs | null = sampleInputsA;
    storyResult: NonNullable<ApiResponse['story_result']> | null = sampleMythA;
    meetingResult: MeetingOfMirrorsResult | null = sampleMeetingA;
    meetingUserNote = 'Личная заметка A';

    // 1. Action: New Code Calculated
    onCodeCalculated(newDate: string, calc: CalculationResult, reading?: FirstMirror | null) {
      this.codeDate = newDate;
      this.codeResult = calc;
      this.firstMirror = reading || null;
      this.meetingResult = null;
      this.meetingUserNote = '';
    }

    // 2. Action: New Myth Completed
    onMythCompleted(inputs: StoryInputs, result: NonNullable<ApiResponse['story_result']> | null) {
      this.storyInputs = inputs;
      this.storyResult = result;
      this.meetingResult = null;
      this.meetingUserNote = '';
    }

    // 3. Action: Select Mode with DOB
    onSelectModeWithDate(initialDate: string) {
      if (initialDate && initialDate !== this.codeDate) {
        this.codeDate = initialDate;
        this.codeResult = null;
        this.firstMirror = null;
        this.meetingResult = null;
        this.meetingUserNote = '';
      }
    }

    // Restore from saved snapshot
    restoreSnapshot() {
      const snapshot = loadMyMirrorSnapshot();
      if (!snapshot) return;
      this.codeDate = snapshot.codeDate;
      this.codeResult = snapshot.codeResult;
      this.firstMirror = snapshot.firstMirror;
      this.storyInputs = snapshot.storyInputs;
      this.storyResult = snapshot.storyResult;
      this.meetingResult = snapshot.meetingResult;
      if (snapshot.meetingUserNote) this.meetingUserNote = snapshot.meetingUserNote;
    }
  }

  it('1. Meeting A exists -> new Code calculation -> active meetingResult is null and note cleared', () => {
    const session = new AppSessionState();
    expect(session.meetingResult).not.toBeNull();
    expect(session.meetingUserNote).toBe('Личная заметка A');

    const newCalc: CalculationResult = {
      ...sampleCalculationA,
      soul: 7,
      path: 9
    };

    session.onCodeCalculated('25.12.1985', newCalc, null);

    expect(session.codeDate).toBe('25.12.1985');
    expect(session.codeResult?.soul).toBe(7);
    expect(session.meetingResult).toBeNull();
    expect(session.meetingUserNote).toBe('');
  });

  it('2. Meeting A exists -> new Myth completion -> active meetingResult is null and note cleared', () => {
    const session = new AppSessionState();
    expect(session.meetingResult).not.toBeNull();
    expect(session.meetingUserNote).toBe('Личная заметка A');

    const newMyth: NonNullable<ApiResponse['story_result']> = {
      ...sampleMythA,
      title: 'Странник в горах',
      story: 'Новая история про вершины...'
    };
    const newInputs: StoryInputs = {
      q1: 'горы',
      q2: 'орел',
      q3: 'ветер',
      q4: 'высота'
    };

    session.onMythCompleted(newInputs, newMyth);

    expect(session.storyResult?.title).toBe('Странник в горах');
    expect(session.meetingResult).toBeNull();
    expect(session.meetingUserNote).toBe('');
  });

  it('3. entering Code with genuinely different DOB invalidates old Code, FirstMirror, and Meeting', () => {
    const session = new AppSessionState();
    expect(session.codeResult).not.toBeNull();
    expect(session.meetingResult).not.toBeNull();

    session.onSelectModeWithDate('01.01.2000');

    expect(session.codeDate).toBe('01.01.2000');
    expect(session.codeResult).toBeNull();
    expect(session.firstMirror).toBeNull();
    expect(session.meetingResult).toBeNull();
    expect(session.meetingUserNote).toBe('');
  });

  it('4. localStorage snapshot survives in-memory invalidations unchanged', () => {
    // Save Meeting A to localStorage
    const saved = saveMyMirrorSnapshot({
      codeDate: '15.08.1990',
      codeResult: sampleCalculationA,
      firstMirror: sampleFirstMirrorA,
      storyInputs: sampleInputsA,
      storyResult: sampleMythA,
      meetingResult: sampleMeetingA,
      meetingUserNote: 'Личная заметка A'
    });
    expect(saved).toBe(true);

    const session = new AppSessionState();
    // Simulate user entering a different DOB and calculating a new code
    session.onSelectModeWithDate('02.02.1995');
    session.onCodeCalculated('02.02.1995', { ...sampleCalculationA, soul: 2 }, null);

    // Assert in-memory meeting is invalidated
    expect(session.meetingResult).toBeNull();

    // Assert localStorage snapshot was NOT deleted or corrupted
    const stored = loadMyMirrorSnapshot();
    expect(stored).not.toBeNull();
    expect(stored?.codeDate).toBe('15.08.1990');
    expect(stored?.codeResult.soul).toBe(6);
    expect(stored?.meetingResult.summary).toBe(sampleMeetingA.summary);
    expect(stored?.meetingUserNote).toBe('Личная заметка A');
  });

  it('5. old saved snapshot can still be explicitly restored after in-memory invalidation', () => {
    saveMyMirrorSnapshot({
      codeDate: '15.08.1990',
      codeResult: sampleCalculationA,
      firstMirror: sampleFirstMirrorA,
      storyInputs: sampleInputsA,
      storyResult: sampleMythA,
      meetingResult: sampleMeetingA,
      meetingUserNote: 'Личная заметка A'
    });

    const session = new AppSessionState();
    session.onSelectModeWithDate('05.05.1980');
    expect(session.codeDate).toBe('05.05.1980');
    expect(session.meetingResult).toBeNull();

    // User clicks "Открыть сохранённое"
    session.restoreSnapshot();

    expect(session.codeDate).toBe('15.08.1990');
    expect(session.codeResult?.soul).toBe(6);
    expect(session.firstMirror?.title).toBe(sampleFirstMirrorA.title);
    expect(session.storyResult?.title).toBe(sampleMythA.title);
    expect(session.meetingResult?.summary).toBe(sampleMeetingA.summary);
    expect(session.meetingUserNote).toBe('Личная заметка A');
  });

  it('6. current-session save badge is false for a different active Meeting even when another snapshot exists', () => {
    // Save Meeting A to localStorage
    saveMyMirrorSnapshot({
      codeDate: '15.08.1990',
      codeResult: sampleCalculationA,
      firstMirror: sampleFirstMirrorA,
      storyInputs: sampleInputsA,
      storyResult: sampleMythA,
      meetingResult: sampleMeetingA
    });

    const snapshot = loadMyMirrorSnapshot();
    expect(snapshot).not.toBeNull();

    // Meeting B (new active session)
    const newMeetingB: MeetingOfMirrorsResult = {
      ...sampleMeetingA,
      summary: 'Совершенно новый синтез B для других зеркал.'
    };

    const isMatch = isSnapshotMatchingCurrentSession(snapshot, {
      codeDate: '15.08.1990',
      codeResult: sampleCalculationA,
      storyResult: sampleMythA,
      meetingResult: newMeetingB
    });

    // Must be false! The active meeting is not the saved one!
    expect(isMatch).toBe(false);
  });

  it('7. explicit Save makes current-session badge true', () => {
    const newMeetingB: MeetingOfMirrorsResult = {
      ...sampleMeetingA,
      summary: 'Совершенно новый синтез B для других зеркал.'
    };

    // Before save
    let snapshot = loadMyMirrorSnapshot();
    expect(isSnapshotMatchingCurrentSession(snapshot, {
      codeDate: '15.08.1990',
      codeResult: sampleCalculationA,
      storyResult: sampleMythA,
      meetingResult: newMeetingB
    })).toBe(false);

    // Explicit save
    saveMyMirrorSnapshot({
      codeDate: '15.08.1990',
      codeResult: sampleCalculationA,
      firstMirror: sampleFirstMirrorA,
      storyInputs: sampleInputsA,
      storyResult: sampleMythA,
      meetingResult: newMeetingB
    });

    // After save
    snapshot = loadMyMirrorSnapshot();
    expect(isSnapshotMatchingCurrentSession(snapshot, {
      codeDate: '15.08.1990',
      codeResult: sampleCalculationA,
      storyResult: sampleMythA,
      meetingResult: newMeetingB
    })).toBe(true);
  });
});
