import { describe, expect, it } from 'vitest';
import { normalizeDateInputValue } from './dateInput';

describe('normalizeDateInputValue', () => {
  it('formats typed digits as a Russian date', () => {
    expect(normalizeDateInputValue('01012000')).toBe('01.01.2000');
  });

  it('ignores calendar events that do not carry an input value', () => {
    expect(normalizeDateInputValue(undefined)).toBeNull();
    expect(normalizeDateInputValue(null)).toBeNull();
  });
});
