import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getMythsAccessLabel, type PreviewStatus } from '../src/services/freePreview';
import { MYTH_COPY } from '../src/services/mythWait';

describe('Release 10 — Личный миф (Acceptance Criteria)', () => {
  describe('1. Absence of deprecated story naming on storefront / UI', () => {
    it('verifies MYTH_COPY has updated writing string', () => {
      expect(MYTH_COPY.writing).toBe('Пишем ваш Личный миф.');
    });

    it('verifies source files do not contain forbidden strings in visible UI copy', () => {
      const filesToCheck = [
        'src/App.tsx',
        'src/components/AlbertDialogue.tsx',
        'src/components/LabEntryView.tsx',
        'src/components/PersonalMyth.tsx',
        'src/components/PersonalStoryLibrary.tsx',
        'server/storyCommerce.ts',
        'server/storyPdf.ts',
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Forbidden strings in UI
        expect(content, `${relPath} should not contain "История по вашей ситуации"`).not.toContain('История по вашей ситуации');
        expect(content, `${relPath} should not contain "Начать историю"`).not.toContain('Начать историю');
        expect(content, `${relPath} should not contain "Создать мою историю"`).not.toContain('Создать мою историю');
        expect(content, `${relPath} should not contain "Прочитать пример истории"`).not.toContain('Прочитать пример истории');
        expect(content, `${relPath} should not contain "Пишем вашу историю."`).not.toContain('Пишем вашу историю.');
      }
    });

    it('verifies story texts in Code and knowledge still preserve the word история', () => {
      const dcsPositionsDir = '/Users/artemkrysin/code/digital-code-system-numeric-houses/content/interpretation_v2/positions';
      if (fs.existsSync(dcsPositionsDir)) {
        const energy8 = fs.readFileSync(path.join(dcsPositionsDir, 'direction/energy_8.md'), 'utf-8');
        expect(energy8).toContain('READER MINI-STORY');
      }
      const samplePath = path.join(process.cwd(), 'src/data/storySample.ts');
      const sampleContent = fs.readFileSync(samplePath, 'utf-8');
      expect(sampleContent.toLowerCase()).toContain('истори');
    });
  });

  describe('2. Access rule (Astra)', () => {
    it('returns "Проверяем доступ…" when access state is unknown (null or undefined)', () => {
      expect(getMythsAccessLabel(null)).toBe('Проверяем доступ…');
      expect(getMythsAccessLabel(undefined)).toBe('Проверяем доступ…');
    });

    it('returns "Мои мифы · бесплатно" when free preview is active', () => {
      const activeStatus: PreviewStatus = {
        enabled: true,
        active: true,
        phase: 'active',
        can_start_myth: true,
        new_generation_available: true,
        pause_message: '',
        support_url: null,
        started_at: Date.now() - 1000,
        ends_at: Date.now() + 100000,
        budget_warning: false,
      };
      expect(getMythsAccessLabel(activeStatus)).toBe('Мои мифы · бесплатно');
      expect(getMythsAccessLabel(true)).toBe('Мои мифы · бесплатно');
    });

    it('returns "Мои мифы" without a price when preview is disabled or inactive (payment not live yet)', () => {
      const inactiveStatus: PreviewStatus = {
        enabled: true,
        active: false,
        phase: 'ended',
        can_start_myth: false,
        new_generation_available: false,
        pause_message: 'Завершено',
        support_url: null,
        started_at: Date.now() - 10000,
        ends_at: Date.now() - 1000,
        budget_warning: false,
      };
      const disabledStatus: PreviewStatus = {
        enabled: false,
        active: false,
        phase: 'disabled',
        can_start_myth: false,
        new_generation_available: false,
        pause_message: '',
        support_url: null,
        started_at: null,
        ends_at: null,
        budget_warning: false,
      };
      expect(getMythsAccessLabel(inactiveStatus)).toBe('Мои мифы');
      expect(getMythsAccessLabel(disabledStatus)).toBe('Мои мифы');
      expect(getMythsAccessLabel(false)).toBe('Мои мифы');
    });
  });

  describe('3. Bridge in Code V2 result', () => {
    it('has exact verbatim bridge text and caption in CodeV2Experience.tsx', () => {
      const codeV2File = path.join(process.cwd(), 'src/components/CodeV2/CodeV2Experience.tsx');
      const content = fs.readFileSync(codeV2File, 'utf-8');

      expect(content).toContain('Альберт — ИИ-собеседник');
      expect(content).toContain(
        'Мы посмотрели на пять сторон жизни через образы чисел. Что из этого вам знакомо — решаете вы. А если хочется обратиться к тому, что происходит сейчас, ответьте на три вопроса. По вашим ответам будет создан Личный миф.'
      );
      expect(content).toContain('Начать Личный миф');
    });

    it('verifies myth creation request payload does not contain birth date or numbers', () => {
      const personalMythFile = path.join(process.cwd(), 'src/components/PersonalMyth.tsx');
      const content = fs.readFileSync(personalMythFile, 'utf-8');

      // The submit handler builds the payload from answers only
      expect(content).toContain('answers');
      expect(content).not.toContain('birth_date');
      expect(content).not.toContain('birthDate');
    });
  });

  describe('4. Example page (/primer-lichnogo-mifa)', () => {
    it('is a client route that reuses the Myth screen; the old static page is gone', () => {
      expect(fs.existsSync(path.join(process.cwd(), 'public/primer-lichnogo-mifa/index.html'))).toBe(false);
      const main = fs.readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf-8');
      expect(main).toContain('MythExamplePage');
    });
  });
});
