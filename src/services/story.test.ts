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

  it('PersonalMyth.tsx does not contain mock alert for lead CTA', () => {
    const fileContent = fs.readFileSync(path.join(__dirname, '../components/PersonalMyth.tsx'), 'utf-8');
    expect(fileContent).not.toContain('alert("Открытие');
    expect(fileContent).toContain('setShowLeadForm(true)');
  });

  it('PersonalMyth.tsx fallback contains correct keys', () => {
    const fileContent = fs.readFileSync(path.join(__dirname, '../components/PersonalMyth.tsx'), 'utf-8');
    expect(fileContent).toContain('mainImage: inputs.q2 ||');
    expect(fileContent).toContain('innerTension: inputs.q1 ||');
    expect(fileContent).toContain('hiddenResource: inputs.q4 ||');
    expect(fileContent).toContain('newView: inputs.q3 ||');
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

  it('server.ts contains new story_result mirror schema and crisis status', () => {
    const serverPath = path.join(__dirname, '../../server.ts');
    if (fs.existsSync(serverPath)) {
      const serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toContain('"status": "crisis"');
      expect(serverContent).toContain('"mirror": {');
      expect(serverContent).toContain('"mainImage"');
      expect(serverContent).toContain('"innerTension"');
    }
  });

  it('LeadModal.tsx содержит birthDate в leadForm и отправляет в /api/lead', () => {
    const fileContent = fs.readFileSync(path.join(__dirname, '../components/LeadModal.tsx'), 'utf-8');
    expect(fileContent).toMatch(/birthDate:/);
    expect(fileContent).toMatch(/\/api\/lead/);
  });

  it('LeadModal.tsx и PersonalMyth.tsx проверяет data.status', () => {
    const leadContent = fs.readFileSync(path.join(__dirname, '../components/LeadModal.tsx'), 'utf-8');
    expect(leadContent).toMatch(/data\.status === 'ok'/);
    
    const pmContent = fs.readFileSync(path.join(__dirname, '../components/PersonalMyth.tsx'), 'utf-8');
    expect(pmContent).toMatch(/data\.status === 'demo'/);
    expect(pmContent).toMatch(/applyFallback\(\)/);
    expect(pmContent).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
