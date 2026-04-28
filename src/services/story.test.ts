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
});
