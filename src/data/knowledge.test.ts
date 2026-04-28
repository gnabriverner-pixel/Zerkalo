import { describe, it, expect } from 'vitest';
import { numberKnowledge } from '../data/numberKnowledge';
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
  it('contains mandatory numbers 1-9 and 11', () => {
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 11].forEach(num => {
      const data = numberKnowledge[num];
      expect(data).toBeDefined();
      expect(data.number).toBe(num);
      expect(data.planet).toBeDefined();
      expect(data.core).toBeDefined();
      expect(data.positions).toBeDefined();
    });
  });

  it('does not contain forbidden words', () => {
    const jsonStr = JSON.stringify(numberKnowledge).toLowerCase();
    expect(jsonStr).not.toContain('исцеление');
    expect(jsonStr).not.toContain('вампир');
    expect(jsonStr).not.toContain('гарантированно');
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

  it('does not contain generic boilerplate strings', () => {
    const jsonStr = JSON.stringify(compoundKnowledge);
    expect(jsonStr).not.toContain('и  ');
    expect(jsonStr).not.toContain('Балансировать проявление составных частей');
    expect(jsonStr).not.toContain('Дисбаланс между');
  });

  it('has sufficient length for accent, risk, and recommendation', () => {
    Object.values(compoundKnowledge).forEach(entry => {
      expect(entry.accent.length).toBeGreaterThanOrEqual(80);
      expect(entry.risk.length).toBeGreaterThanOrEqual(80);
      expect(entry.recommendation.length).toBeGreaterThanOrEqual(80);
    });
  });
});
