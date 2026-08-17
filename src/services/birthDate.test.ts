import { describe, expect, it } from 'vitest';
import { validateBirthDate } from './birthDate';

const today = new Date(2026, 7, 15);

describe('validateBirthDate', () => {
  it('accepts a real leap-day birth date', () => {
    expect(validateBirthDate('29', '02', '2024', today)).toEqual({ valid: true, formatted: '29.02.2024' });
  });
  it('rejects impossible and future dates', () => {
    expect(validateBirthDate('31', '02', '2020', today).valid).toBe(false);
    expect(validateBirthDate('16', '08', '2026', today).valid).toBe(false);
  });
});
