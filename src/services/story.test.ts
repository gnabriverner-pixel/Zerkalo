import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Story Module constraints', () => {
  it('PersonalMyth.tsx does not contain forbidden words', () => {
    const fileContent = fs.readFileSync(path.join(__dirname, '../components/PersonalMyth.tsx'), 'utf-8').toLowerCase();
    
    expect(fileContent).not.toMatch(/терап/i);
    expect(fileContent).not.toMatch(/исцел/i);
    expect(fileContent).not.toMatch(/диагноз/i);
    expect(fileContent).not.toMatch(/гипноз/i);
    expect(fileContent).not.toMatch(/лечение/i);
    expect(fileContent).not.toMatch(/травма/i);
    expect(fileContent).not.toMatch(/предсказ/i);
    expect(fileContent).not.toMatch(/магия/i);
  });

  it('PersonalMyth.tsx does not contain fake result fallback', () => {
    const fileContent = fs.readFileSync(path.join(__dirname, '../components/PersonalMyth.tsx'), 'utf-8');
    expect(fileContent).not.toContain('applyFallback');
    expect(fileContent).not.toContain('title: "Отражение"');
    expect(fileContent).toContain("localStorage.setItem(DRAFT_KEY");
    expect(fileContent).toContain("'/api/personal-myth/generate'");
  });

  it('server prompt does not use forbidden words loosely or directly in user-facing text', () => {
    const serverPath = path.join(__dirname, '../../server.ts');
    if (fs.existsSync(serverPath)) {
      const serverContent = fs.readFileSync(serverPath, 'utf-8').toLowerCase();
      // It's allowed as a negative constraint, but let's test if the string for safe_message contains it
      const safeMessageMatch = serverContent.match(/"safe_message":\s*"([^"]+)"/g);
      if (safeMessageMatch) {
         safeMessageMatch.forEach(match => {
            expect(match).not.toMatch(/терап/i);
            expect(match).not.toMatch(/исцел/i);
            expect(match).not.toMatch(/диагноз/i);
            expect(match).not.toMatch(/гипноз/i);
            expect(match).not.toMatch(/лечение/i);
            expect(match).not.toMatch(/травма/i);
            expect(match).not.toMatch(/предсказ/i);
            expect(match).not.toMatch(/магия/i);
         });
      }
    }
  });

  it('personal myth prompt contains the result schema and server returns crisis status', () => {
    const serverPath = path.join(__dirname, '../../server.ts');
    const mythPath = path.join(__dirname, '../../server/personalMyth.ts');
    if (fs.existsSync(serverPath)) {
      const serverContent = fs.readFileSync(serverPath, 'utf-8');
      const mythContent = fs.readFileSync(mythPath, 'utf-8');
      expect(serverContent).toContain('status: "crisis"');
      expect(mythContent).toContain('"mirror": {');
      expect(mythContent).toContain('"mainImage"');
      expect(mythContent).toContain('"answer_echoes"');
    }
  });

  it('LeadModal.tsx содержит birthDate в leadForm и отправляет в /api/lead', () => {
    const fileContent = fs.readFileSync(path.join(__dirname, '../components/LeadModal.tsx'), 'utf-8');
    expect(fileContent).toMatch(/birthDate:/);
    expect(fileContent).toMatch(/\/api\/lead/);
  });

  it('LeadModal.tsx and PersonalMyth.tsx check data.status', () => {
    const leadContent = fs.readFileSync(path.join(__dirname, '../components/LeadModal.tsx'), 'utf-8');
    expect(leadContent).toMatch(/data\.status === 'ok'/);
    
    const pmContent = fs.readFileSync(path.join(__dirname, '../components/PersonalMyth.tsx'), 'utf-8');
    expect(pmContent).toMatch(/data\.status === 'ok'/);
    expect(pmContent).toMatch(/data\.status === 'unavailable'/);
    expect(pmContent).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
