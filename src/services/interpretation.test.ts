import { describe, it, expect } from 'vitest';
import { generateFirstMirror } from './interpretation';
import { calculateDigitalCode } from './calculator';

describe('Digital Code Editorial Engine (Interpretation)', () => {
  const testDates = [
    '06.05.1986',
    '15.03.1990',
    '25.12.1985',
    '29.02.2000',
    '01.01.1980',
    '19.09.1999',
    '11.11.1988',
    '31.12.1995'
  ];

  testDates.forEach((dateStr) => {
    describe(`Editorial quality for ${dateStr}`, () => {
      const calc = calculateDigitalCode(dateStr);
      const mirror = generateFirstMirror(calc);

      it('generates 5 complete, non-empty blocks', () => {
        expect(mirror.blocks).toHaveLength(5);
        mirror.blocks.forEach((b) => {
          expect(b.title.trim().length).toBeGreaterThan(0);
          expect(b.text.trim().length).toBeGreaterThan(50);
        });
      });

      it('contains no broken punctuation or nested quotes (.,, ««, »», "")', () => {
        mirror.blocks.forEach((b) => {
          expect(b.text).not.toContain('.,');
          expect(b.text).not.toContain(',.');
          expect(b.text).not.toContain('««');
          expect(b.text).not.toContain('»»');
          expect(b.text).not.toContain('""');
          expect(b.text).not.toMatch(/\.\s+[а-яё]/); // Every sentence after a period starts with an uppercase letter
        });
      });

      it('maintains pure polite "вы" register in Digital Code (zero "ты/твой")', () => {
        mirror.blocks.forEach((b) => {
          expect(b.text).not.toMatch(/\b(ты|тебя|тебе|тобой|твой|твоя|твое|твои|твоих|твоем|твоей)\b/i);
        });
      });

      it('contains no broken subordinate clause fragments or forbidden pseudo-depth', () => {
        mirror.blocks.forEach((b) => {
          expect(b.text).not.toMatch(/когда вам нужно [а-яё]+ (и|или) [а-яё]+/i);
          expect(b.text).not.toMatch(/где вы сможете [а-яё]+те\b/i); // e.g. "где вы сможете осознайте"
          expect(b.text).not.toMatch(/вы транслируете способность/i);
        });
      });
    });
  });

  it('verifies exact block ids for 06.05.1986', () => {
    const calc = calculateDigitalCode('06.05.1986');
    const mirror = generateFirstMirror(calc);
    const blockIds = mirror.blocks.map(b => b.id);
    expect(blockIds).toEqual(['main_pattern', 'strength', 'tension', 'step', 'resonance']);
  });
});
