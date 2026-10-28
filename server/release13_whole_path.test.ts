import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parsePastedDate } from '../src/components/LabEntryView';
import { validateBirthDate } from '../src/services/birthDate';

describe('Release 13 — «Цельный путь» (Acceptance Tests)', () => {
  const rootDir = process.cwd();

  describe('1. Date paste and formatting', () => {
    it('parses formatted date "14.03.1987" into day, month, year', () => {
      const parsed = parsePastedDate('14.03.1987');
      expect(parsed).toEqual({ day: '14', month: '03', year: '1987' });
      const valid = validateBirthDate(parsed.day, parsed.month, parsed.year);
      expect(valid.valid).toBe(true);
      if (valid.valid) {
        expect(valid.formatted).toBe('14.03.1987');
      }
    });

    it('parses raw 8-digit date "14031987" into day, month, year', () => {
      const parsed = parsePastedDate('14031987');
      expect(parsed).toEqual({ day: '14', month: '03', year: '1987' });
      const valid = validateBirthDate(parsed.day, parsed.month, parsed.year);
      expect(valid.valid).toBe(true);
      if (valid.valid) {
        expect(valid.formatted).toBe('14.03.1987');
      }
    });

    it('verifies LabEntryView copy: subtitle, date-first order, Albert lead, and draft block', () => {
      const labEntryPath = path.join(rootDir, 'src/components/LabEntryView.tsx');
      const content = fs.readFileSync(labEntryPath, 'utf-8');

      // Subtitle
      expect(content).toContain('Начните с даты рождения: пять сторон жизни через истории и вопросы.');
      // Albert lead
      expect(content).toContain('Начните с даты: так проще увидеть, как здесь всё устроено. Личный миф можно открыть и сразу.');
      // Date anchor & scroll target
      expect(content).toContain('id="date-gate"');
      expect(content).toContain('href="#date-gate"');
      // Draft block copy
      expect(content).toContain('Продолжить разбор');
      expect(content).toContain('Вы не закончили разбор');
      // No forbidden deprecated draft phrasing
      expect(content).not.toContain('Черновик сессии · В процессе');
      expect(content).not.toContain('Найдено незавершённое зеркало');
    });
  });

  describe('2. Code V2 Static Sample without Consent', () => {
    const fixturePath = path.join(rootDir, 'public/examples/code-v2-14031987.json');

    it('has canonical static snapshot fixture for 14.03.1987', () => {
      expect(fs.existsSync(fixturePath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
      const payload = parsed.payload || parsed;
      expect(payload.calculation?.date || payload.calculation_date).toBe('14.03.1987');
      expect(payload.positions).toHaveLength(5);
    });

    it('verifies CodeV2Experience contains sample banner and disables consent-triggering reactions', () => {
      const codeV2ExpPath = path.join(rootDir, 'src/components/CodeV2/CodeV2Experience.tsx');
      const content = fs.readFileSync(codeV2ExpPath, 'utf-8');

      // Sample disclaimer banner
      expect(content).toContain('Пример разбора для вымышленной даты 14.03.1987.');
      // Date indicator in sample mode
      expect(content).toContain('Пример пяти чисел');
      expect(content).toContain('Ввести свою дату');
      // isExample prop
      expect(content).toContain('isExample');
      // Myth bridge remains active
      expect(content).toContain('Личный миф');
    });

    it('verifies sample loading in LabEntryView uses static JSON without API calls', () => {
      const labEntryPath = path.join(rootDir, 'src/components/LabEntryView.tsx');
      const content = fs.readFileSync(labEntryPath, 'utf-8');

      expect(content).toContain('/examples/code-v2-14031987.json');
      expect(content).toContain('isExample: true');
    });
  });

  describe('3. Personal Myth: Q4, trial copy, obsidian emblems, contrast', () => {
    it('verifies Question 4 title and key', () => {
      const mythPath = path.join(rootDir, 'src/components/PersonalMyth.tsx');
      const content = fs.readFileSync(mythPath, 'utf-8');

      // Q4 question title
      expect(content).toContain('В какой момент вы чувствовали, что живёте по-настоящему или нужны кому-то?');
      // Key remains q3
      expect(content).toContain("id: 'q3'");
      // Trial access copy
      expect(content).toContain('Что в истории вам близко, решаете вы.');
      // All emblems changed to obsidian (no alabaster)
      expect(content).not.toContain('variant="alabaster"');
      expect(content).toContain('variant="obsidian"');
      // Contrast classes
      expect(content).toContain('placeholder:text-stone-300');
      expect(content).toContain('text-stone-300');
    });
  });

  describe('4. «Мои мифы» (PersonalStoryLibrary): order, empty state, collapsed details', () => {
    it('verifies PersonalStoryLibrary structure', () => {
      const libraryPath = path.join(rootDir, 'src/components/PersonalStoryLibrary.tsx');
      const content = fs.readFileSync(libraryPath, 'utf-8');

      // 1. Header
      expect(content).toContain('<h1 id="story-title">Мои мифы</h1>');
      // 2. Empty state
      expect(content).toContain('Здесь появятся ваши Личные мифы.');
      expect(content).toContain('Начать Личный миф');
      expect(content).toContain('Прочитать пример Личного мифа');
      // 3. Access string
      expect(content).toContain('Проверяем доступ…');
      expect(fs.readFileSync(path.join(process.cwd(), 'src/services/freeWindowLine.ts'), 'utf-8')).toContain('Пробный доступ — бесплатно до');
      // 4. Collapsible details «Хранение и доступ»
      expect(content).toContain('<details className="story-details">');
      expect(content).toContain('<summary>Хранение и доступ</summary>');
      // Escape key closes dialog
      expect(content).toContain("e.key === 'Escape'");
      // onStartMyth prop
      expect(content).toContain('onStartMyth');
    });

    it('verifies personalStoryLibrary.css styling tokens', () => {
      const cssPath = path.join(rootDir, 'src/components/personalStoryLibrary.css');
      const content = fs.readFileSync(cssPath, 'utf-8');

      expect(content).toContain('#0D121D');
      expect(content).toContain('#F2EFE9');
      expect(content).toContain('.story-details');
      expect(content).toContain('.story-empty');
    });
  });
});
