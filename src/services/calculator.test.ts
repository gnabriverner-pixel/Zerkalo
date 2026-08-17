// src/services/calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDigitalCode, reduceVerbously } from './calculator';
import goldenSpec from '../../docs/evidence/v1_1-audit/canonical_golden_spec_25.json';

describe('Vedic Numerology Canonical Calculation Engine (Protocol Calculation v1)', () => {
  describe('reduceVerbously', () => {
    it('correctly reduces single digit numbers', () => {
      expect(reduceVerbously(6)).toEqual({ value: 6, composite: '6', history: [6] });
      expect(reduceVerbously(1)).toEqual({ value: 1, composite: '1', history: [1] });
      expect(reduceVerbously(9)).toEqual({ value: 9, composite: '9', history: [9] });
    });

    it('correctly reduces 2-step compound numbers', () => {
      expect(reduceVerbously(15)).toEqual({ value: 6, composite: '15/6', history: [15, 6] });
      expect(reduceVerbously(35)).toEqual({ value: 8, composite: '35/8', history: [35, 8] });
      expect(reduceVerbously(33)).toEqual({ value: 6, composite: '33/6', history: [33, 6] });
    });

    it('correctly reduces 3-step compound numbers (including 29, 28, 82)', () => {
      expect(reduceVerbously(29)).toEqual({ value: 2, composite: '29/11/2', history: [29, 11, 2] });
      expect(reduceVerbously(28)).toEqual({ value: 1, composite: '28/10/1', history: [28, 10, 1] });
      expect(reduceVerbously(82)).toEqual({ value: 1, composite: '82/10/1', history: [82, 10, 1] });
      expect(reduceVerbously(96)).toEqual({ value: 6, composite: '96/15/6', history: [96, 15, 6] });
    });
  });

  describe('25 Golden DOB Parity Suite', () => {
    for (const [dob, expected] of Object.entries<any>(goldenSpec)) {
      it(`matches canonical golden spec for DOB: ${dob}`, () => {
        const result = calculateDigitalCode(dob);

        // 1. Soul (ЧУ)
        expect(result.soul, `Soul digit for ${dob}`).toBe(expected.mind.digit);
        expect(result.soulComposite, `Soul composite for ${dob}`).toBe(expected.mind.composite);

        // 2. Expression (ЧВ)
        expect(result.expression, `Expression digit for ${dob}`).toBe(expected.expression.digit);
        expect(result.expressionComposite, `Expression composite for ${dob}`).toBe(expected.expression.composite);

        // 3. Path (ЧД)
        expect(result.path, `Path digit for ${dob}`).toBe(expected.action.digit);
        expect(result.pathComposite, `Path composite for ${dob}`).toBe(expected.action.composite);

        // 4. Direction (ЧР)
        expect(result.direction, `Direction digit for ${dob}`).toBe(expected.realization.digit);
        expect(result.directionComposite, `Direction composite for ${dob}`).toBe(expected.realization.composite);

        // 5. Result (ЧИ)
        expect(result.result, `Result digit for ${dob}`).toBe(expected.outcome.digit);
        expect(result.resultComposite, `Result composite for ${dob}`).toBe(expected.outcome.composite);

        // 6. Base Matrix (1..9)
        for (let i = 1; i <= 9; i++) {
          const key = i.toString();
          expect(result.baseMatrix[key], `Base matrix [${key}] for ${dob}`).toBe(expected.simple_matrix[key]);
        }

        // 7. Detailed Matrix (1..9)
        for (let i = 1; i <= 9; i++) {
          const key = i.toString();
          expect(result.detailedMatrix[key], `Detailed matrix [${key}] for ${dob}`).toBe(expected.detailed_matrix[key]);
        }
      });
    }
  });

  describe('Property & Invariant Tests', () => {
    const propertyDates = [
      '01.01.1970', '15.08.1990', '29.02.2000', '31.12.1999', '28.09.1994',
      '11.11.2011', '22.02.2022', '07.07.1977', '19.10.1991', '24.06.1985'
    ];

    it('always reduces all 5 main numbers to single digits 1..9', () => {
      propertyDates.forEach((dob) => {
        const res = calculateDigitalCode(dob);
        expect(res.soul).toBeGreaterThanOrEqual(1);
        expect(res.soul).toBeLessThanOrEqual(9);

        expect(res.expression).toBeGreaterThanOrEqual(1);
        expect(res.expression).toBeLessThanOrEqual(9);

        expect(res.path).toBeGreaterThanOrEqual(1);
        expect(res.path).toBeLessThanOrEqual(9);

        expect(res.direction).toBeGreaterThanOrEqual(1);
        expect(res.direction).toBeLessThanOrEqual(9);

        expect(res.result).toBeGreaterThanOrEqual(1);
        expect(res.result).toBeLessThanOrEqual(9);
      });
    });

    it('ensures detailed matrix counts are >= base matrix counts for all digits 1..9', () => {
      propertyDates.forEach((dob) => {
        const res = calculateDigitalCode(dob);
        for (let i = 1; i <= 9; i++) {
          const key = i.toString();
          expect(res.detailedMatrix[key]).toBeGreaterThanOrEqual(res.baseMatrix[key]);
        }
      });
    });

    it('handles malformed date inputs safely with fallbacks', () => {
      const emptyRes = calculateDigitalCode('');
      expect(emptyRes.soul).toBe(1);
      expect(emptyRes.path).toBeGreaterThanOrEqual(1);

      const invalidRes = calculateDigitalCode('invalid.date');
      expect(invalidRes.soul).toBe(1);
    });
  });
});
