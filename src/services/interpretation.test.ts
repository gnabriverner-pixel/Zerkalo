import { describe, it, expect } from 'vitest';
import { generateFirstMirror } from './interpretation';
import { calculateDigitalCode } from './calculator';

describe('interpretation', () => {
  it('generates a valid FirstMirror object for 06.05.1986', () => {
    const calc = calculateDigitalCode("06.05.1986");
    const mirror = generateFirstMirror(calc);
    
    expect(mirror.title).toBeDefined();
    expect(mirror.blocks.length).toBe(4);
    expect(mirror.formula.numbers).toContain('6');
    expect(mirror.formula.numbers).toContain('8');
    
    const textStr = JSON.stringify(mirror.blocks);
    expect(textStr).not.toMatch(/диагноз/i);
    expect(textStr).not.toMatch(/исцеление/i);
    expect(textStr).not.toMatch(/100%/i);
  });
});
