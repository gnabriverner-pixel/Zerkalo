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

      it('contains no duplicate compound paragraphs or identical risk/recommendation sentences', () => {
        mirror.blocks.forEach((b) => {
          const paragraphs = b.text.split('\n\n').map(p => p.trim()).filter(Boolean);
          const normalized = paragraphs.map(p => p.toLowerCase().replace(/[^а-яёa-z0-9]/g, ''));
          const unique = new Set(normalized);
          expect(unique.size).toBe(normalized.length);
        });
      });

      it('strictly obeys semantic safety boundaries (no clinical diagnoses, esoteric claims, or fatalistic guarantees)', () => {
        mirror.blocks.forEach((b) => {
          // No clinical/therapeutic diagnosing language
          expect(b.text).not.toMatch(/\b(диагноз|исцелен|патолог|терапи|симптом|лечени)\w*/i);
          // No forbidden esoteric / magic jargon
          expect(b.text).not.toMatch(/\b(карм|магическ|эзотерик|астрал|порч|сглаз)\w*/i);
          // No fatalistic predictions or rigid guarantees
          expect(b.text).not.toMatch(/\b(гарантированно|неизбежно|вам суждено|вы точно|на 100%)\b/i);
        });
      });

      it('contains no broken subordinate clause fragments or forbidden pseudo-depth templates', () => {
        mirror.blocks.forEach((b) => {
          expect(b.text).not.toMatch(/когда вам нужно [а-яё]+ (и|или) [а-яё]+/i);
          expect(b.text).not.toMatch(/где вы сможете [а-яё]+те\b/i); // e.g. "где вы сможете осознайте"
          expect(b.text).not.toMatch(/вы транслируете способность/i);
        });
      });
    });
  });

  it('verifies 15.03.1990 editorial quality and clean omission of unsupported compound semantics', () => {
    const calc = calculateDigitalCode('15.03.1990');
    const mirror = generateFirstMirror(calc);
    const tensionBlock = mirror.blocks.find(b => b.id === 'tension');
    const stepBlock = mirror.blocks.find(b => b.id === 'step');

    expect(tensionBlock).toBeDefined();
    // Base tension lines must be present and well-formed
    expect(tensionBlock!.text).toContain('По линии Направления характерно следующее напряжение:');
    expect(tensionBlock!.text).toContain('По линии Пути может проявляться:');
    // Unsupported compound paragraphs must not be fabricated
    expect(tensionBlock!.text).not.toContain('Скрытый сценарий перехода (28/10/1)');
    expect(tensionBlock!.text).not.toContain('Векторный нюанс (43/7)');

    expect(stepBlock).toBeDefined();
    expect(stepBlock!.text).toContain('Практический ориентир по Направлению:');
    expect(stepBlock!.text).toContain('Ориентир по линии Результата:');
    expect(stepBlock!.text).not.toContain('Дополнительный фокус (86/14/5)');
  });

  it('verifies exact block ids for 06.05.1986', () => {
    const calc = calculateDigitalCode('06.05.1986');
    const mirror = generateFirstMirror(calc);
    const blockIds = mirror.blocks.map(b => b.id);
    expect(blockIds).toEqual(['main_pattern', 'strength', 'tension', 'step', 'resonance']);
  });

  it('CODE_VOICE_CONTRACT: static Code surface and AlabasterSanctuary have zero informal second-person words', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const alabasterCode = fs.readFileSync(path.resolve(__dirname, '../components/AlabasterSanctuary.tsx'), 'utf-8');
    
    // Check all user-facing JSX text inside AlabasterSanctuary.tsx
    const informalRegex = /\b(ты|тебя|тебе|тобой|тобою|твой|твоя|твое|твоё|твои|твоих|твоем|твоём|твоей|твоему|твоим|твоими)\b/i;
    
    // Extract JSX text nodes and strings
    const matches = alabasterCode.match(informalRegex);
    expect(matches).toBeNull();
  });
});
