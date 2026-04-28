import { describe, it, expect } from 'vitest';
import { generateFirstMirror } from './interpretation';
import { calculateDigitalCode } from './calculator';

describe('interpretation', () => {
  it('generates a valid FirstMirror object for 06.05.1986', () => {
    const calc = calculateDigitalCode("06.05.1986");
    const mirror = generateFirstMirror(calc);
    
    expect(mirror.title).toBeDefined();
    expect(mirror.blocks.length).toBe(4);
    
    const textStr = JSON.stringify(mirror);
    expect(textStr).toContain('6');
    expect(textStr).toContain('8');
    expect(textStr).toContain('11');
    expect(textStr).toContain('5');
    expect(textStr).toContain('1');

    expect(mirror.cta).toBeDefined();
    expect(mirror.disclaimer).toBeDefined();

    const lowerStr = textStr.toLowerCase();
    expect(lowerStr).not.toMatch(/диагноз/i);
    expect(lowerStr).not.toMatch(/исцел/i);
    expect(lowerStr).not.toMatch(/духовн/i);
    expect(lowerStr).not.toMatch(/кризис/i);
    expect(lowerStr).not.toMatch(/карм/i);
    expect(lowerStr).not.toMatch(/гарантир/i);
    expect(lowerStr).not.toMatch(/предсказ/i);
    expect(lowerStr).not.toMatch(/обреч/i);
    expect(lowerStr).not.toMatch(/вампир/i);
    expect(lowerStr).not.toMatch(/синдром/i);
    expect(lowerStr).not.toMatch(/судьба неизбежна/i);
    expect(lowerStr).not.toMatch(/высшие энергии/i);
    expect(lowerStr).not.toMatch(/вы точно/i);
  });
});
