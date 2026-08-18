import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDigitalCode } from './calculator';
import { validateBirthDate } from './birthDate';
import { generateFirstMirror } from './interpretation';
import { getNumberKnowledge } from '../data/numberKnowledge';
import { 
  saveMyMirrorSnapshot, 
  loadMyMirrorSnapshot, 
  deleteMyMirrorSnapshot, 
  MY_MIRROR_STORAGE_KEY 
} from './myMirrorStorage';
import { PLANETARY_GEOMETRIES, PLANETARY_METADATA } from '../art/emblem/geometry';
import { MeetingOfMirrorsResult } from '../types';

describe('Zerkalo V1.1 Full Product Regression Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Route 1 & 2 Core Invariants: Calculation & Knowledge', () => {
    it('strictly validates DOB (rejects invalid/future/leap-year dates, accepts valid 29.02.2000)', () => {
      expect(validateBirthDate('29', '02', '2000').valid).toBe(true);
      expect(validateBirthDate('29', '02', '1900').valid).toBe(false);
      expect(validateBirthDate('31', '02', '2024').valid).toBe(false);
      expect(validateBirthDate('32', '01', '1990').valid).toBe(false);
      expect(validateBirthDate('15', '13', '1990').valid).toBe(false);
      expect(validateBirthDate('01', '01', '2099').valid).toBe(false);
      expect(validateBirthDate('a', 'b', 'c').valid).toBe(false);
    });

    it('calculates 5 core keys in strict 1..9 range and excludes 0 from matrices', () => {
      const calc = calculateDigitalCode('06.05.1986');
      expect(calc.soul).toBe(6);
      expect(calc.expression).toBe(2);
      expect(calc.path).toBe(8);
      expect(calc.direction).toBe(5);
      expect(calc.result).toBe(1);

      // Invariant: zero excluded from matrices
      expect('0' in calc.baseMatrix).toBe(false);
      expect('0' in calc.detailedMatrix).toBe(false);

      // Invariant: matrices contain only 1..9
      for (const k of Object.keys(calc.baseMatrix)) {
        const numKey = Number(k);
        expect(numKey).toBeGreaterThanOrEqual(1);
        expect(numKey).toBeLessThanOrEqual(9);
      }
    });

    it('getNumberKnowledge succeeds for 1..9 and throws on invalid inputs (no silent Sun 1 fallback)', () => {
      for (let i = 1; i <= 9; i++) {
        const info = getNumberKnowledge(i);
        expect(info.number).toBe(i);
        expect(info.planet).toBeDefined();
        expect(info.positions.soul).toBeDefined();
        expect(info.positions.path).toBeDefined();
      }

      expect(() => getNumberKnowledge(0)).toThrow(/Invariant Violation/);
      expect(() => getNumberKnowledge(10)).toThrow(/Invariant Violation/);
      expect(() => getNumberKnowledge(NaN)).toThrow(/Invariant Violation/);
    });

    it('generates rich FirstMirror reading deterministically', () => {
      const calc = calculateDigitalCode('06.05.1986');
      const mirror = generateFirstMirror(calc);
      expect(mirror.title).toBeDefined();
      expect(mirror.keyInsight).toBeDefined();
      expect(mirror.formula).toBeDefined();
      expect(mirror.blocks).toHaveLength(5);
    });
  });

  describe('Route 1 & 2 Synthesis: My Mirror Snapshot Persistence', () => {
    it('saves, validates, and reloads full synthesis snapshot', () => {
      const calc = calculateDigitalCode('06.05.1986');
      const firstMirror = generateFirstMirror(calc);

      const sampleStoryInputs = {
        q1: 'напряжение в выборе пути',
        q2: 'корабль в тумане',
        q3: 'тихий рассвет на берегу',
        q4: 'ясность следующего шага'
      };

      const sampleStoryResult = {
        title: 'Песчаный компас',
        story: 'Параграф первый...\n\nПараграф второй...\n\nПараграф третий...\n\nПараграф четвертый.',
        mirror: {
          mainImage: 'Компас на песке',
          innerTension: 'Потеря ориентира',
          hiddenResource: 'Память о береге',
          newView: 'Взгляд вперед'
        },
        meaning: ['Смысл 1', 'Смысл 2'],
        one_step: 'Сделай один шаг',
        journal_question: 'Что для тебя ясность?',
        disclaimer: 'Не является предсказанием.'
      };

      const sampleMeetingResult: MeetingOfMirrorsResult = {
        summary: 'Итоговое сопоставление',
        hasStrongParallels: true,
        confidenceNote: 'Высокая степень созвучия',
        parallels: [
          { theme: 'Творчество', codeAnchor: 'Душа 6', mythAnchor: 'Берег', synthesis: 'Творческое созидание' }
        ],
        divergences: [],
        reflectiveQuestion: 'Что откликается сильнее всего?',
        albertInsight: 'Вопрос для диалога',
        disclaimer: 'Образный формат для саморефлексии.'
      };

      const saved = saveMyMirrorSnapshot({
        codeDate: '06.05.1986',
        codeResult: calc,
        firstMirror,
        storyInputs: sampleStoryInputs,
        storyResult: sampleStoryResult,
        meetingResult: sampleMeetingResult,
        meetingUserNote: 'Заметка исследователя'
      });

      expect(saved).toBe(true);

      const loaded = loadMyMirrorSnapshot();
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.codeDate).toBe('06.05.1986');
      expect(loaded?.storyResult.title).toBe('Песчаный компас');
      expect(loaded?.meetingResult.summary).toBe('Итоговое сопоставление');
      expect(loaded?.meetingUserNote).toBe('Заметка исследователя');

      // Delete snapshot
      const deleted = deleteMyMirrorSnapshot();
      expect(deleted).toBe(true);
      expect(loadMyMirrorSnapshot()).toBeNull();
    });

    it('rejects corrupt or tampered snapshot payloads gracefully', () => {
      localStorage.setItem(MY_MIRROR_STORAGE_KEY, JSON.stringify({ version: 2, bad: true }));
      expect(loadMyMirrorSnapshot()).toBeNull();

      localStorage.setItem(MY_MIRROR_STORAGE_KEY, 'not-valid-json');
      expect(loadMyMirrorSnapshot()).toBeNull();
    });
  });

  describe('«Гипсотека» Planetary Art System Invariants', () => {
    it('has valid SVG geometry and metadata for all 9 planets', () => {
      for (let p = 1; p <= 9; p++) {
        const meta = PLANETARY_METADATA[p];
        expect(meta).toBeDefined();
        expect(meta.name).toBeDefined();
        expect(meta.sanskrit).toBeDefined();
        expect(meta.alloy).toBeDefined();
        expect(meta.title).toBeDefined();

        const GeomComponent = PLANETARY_GEOMETRIES[p];
        expect(GeomComponent).toBeDefined();
        expect(typeof GeomComponent).toBe('function');
      }
    });
  });
});
