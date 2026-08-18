import { describe, it, expect } from 'vitest';
import { numberKnowledge, getNumberKnowledge } from '../data/numberKnowledge';
import { compoundKnowledge } from '../data/compoundKnowledge';
import fs from 'fs';
import path from 'path';

describe('Project setup', () => {
  it('should have leads.json in .gitignore', () => {
    const gitignorePath = path.resolve(__dirname, '../../.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toContain('leads.json');
  });
});

describe('numberKnowledge', () => {
  it('contains strictly valid planetary archetypes 1..9', () => {
    const keys = Object.keys(numberKnowledge).map(Number);
    expect(keys.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(num => {
      const data = numberKnowledge[num];
      expect(data).toBeDefined();
      expect(data.number).toBe(num);
      expect(data.planet).toBeDefined();
      expect(data.core).toBeDefined();
      expect(data.positions).toBeDefined();
    });
  });

  it('getNumberKnowledge returns correct archetype for valid 1..9 and throws on invalid numbers (including 11, 22, 33)', () => {
    for (let i = 1; i <= 9; i++) {
      const k = getNumberKnowledge(i);
      expect(k.number).toBe(i);
      expect(k.planet).toBeDefined();
    }

    expect(() => getNumberKnowledge(0)).toThrow(/Invariant Violation/);
    expect(() => getNumberKnowledge(10)).toThrow(/Invariant Violation/);
    expect(() => getNumberKnowledge(11)).toThrow(/Invariant Violation/);
    expect(() => getNumberKnowledge(22)).toThrow(/Invariant Violation/);
    expect(() => getNumberKnowledge(33)).toThrow(/Invariant Violation/);
    expect(() => getNumberKnowledge(-1)).toThrow(/Invariant Violation/);
    expect(() => getNumberKnowledge(NaN)).toThrow(/Invariant Violation/);
    expect(() => getNumberKnowledge(1.5)).toThrow(/Invariant Violation/);
  });

  it('does not contain mixed-script corruptions or forbidden pseudo-copy', () => {
    const jsonStr = JSON.stringify(numberKnowledge);
    // Bengali or other non-Cyrillic/non-Latin/non-punctuation corruptions
    expect(jsonStr).not.toMatch(/[^\u0000-\u007F\u0400-\u04FF\u2000-\u206F\u2010-\u2027\u00A0-\u00FF«»—]/u);
    // Pseudo-AI copy
    expect(jsonStr).not.toContain('терабайты энергии');
    expect(jsonStr).not.toContain('визионерского свечения');
    expect(jsonStr).not.toContain('не শুধু тенью');
  });

  it('does not contain forbidden public words', () => {
    const jsonStr = JSON.stringify(numberKnowledge).toLowerCase();
    expect(jsonStr).not.toMatch(/исцел/i);
    expect(jsonStr).not.toMatch(/кризис/i);
    expect(jsonStr).not.toMatch(/карм/i);
    expect(jsonStr).not.toMatch(/гарантир/i);
    expect(jsonStr).not.toMatch(/предсказ/i);
    expect(jsonStr).not.toMatch(/диагноз/i);
    expect(jsonStr).not.toMatch(/обреч/i);
    expect(jsonStr).not.toMatch(/вампир/i);
    expect(jsonStr).not.toMatch(/синдром/i);
    expect(jsonStr).not.toMatch(/судьба неизбежна/i);
  });
});

describe('compoundKnowledge', () => {
  it('contains specifically requested values', () => {
    const required = [35, 41, 82];
    required.forEach(num => {
      const entry = Object.values(compoundKnowledge).find(c => c.value === num);
      expect(entry).toBeDefined();
    });
  });

  it('does not contain generic boilerplate strings or forbidden words', () => {
    const jsonStr = JSON.stringify(compoundKnowledge).toLowerCase();
    expect(jsonStr).not.toContain('и  ');
    expect(jsonStr).not.toContain('балансировать проявление составных частей');
    expect(jsonStr).not.toContain('дисбаланс между');
    expect(jsonStr).not.toMatch(/исцел/i);
    expect(jsonStr).not.toMatch(/духовн/i);
    expect(jsonStr).not.toMatch(/кризис/i);
    expect(jsonStr).not.toMatch(/карм/i);
    expect(jsonStr).not.toMatch(/гарантир/i);
    expect(jsonStr).not.toMatch(/предсказ/i);
    expect(jsonStr).not.toMatch(/диагноз/i);
    expect(jsonStr).not.toMatch(/обреч/i);
    expect(jsonStr).not.toMatch(/вампир/i);
    expect(jsonStr).not.toMatch(/синдром/i);
    expect(jsonStr).not.toMatch(/судьба неизбежна/i);
    expect(jsonStr).not.toMatch(/высшие энергии/i);
  });

  it('has sufficient length for accent, risk, and recommendation', () => {
    Object.values(compoundKnowledge).forEach(entry => {
      expect(entry.accent.length).toBeGreaterThanOrEqual(80);
      expect(entry.risk.length).toBeGreaterThanOrEqual(80);
      expect(entry.recommendation.length).toBeGreaterThanOrEqual(80);
    });
  });
});
