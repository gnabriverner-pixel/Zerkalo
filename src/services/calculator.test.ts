import { describe, it, expect } from 'vitest';
import { calculateDigitalCode } from './calculator';

describe('calculator', () => {
  it('correctly calculates digital code for 06.05.1986', () => {
    const calc = calculateDigitalCode("06.05.1986");
    expect(calc).toBeDefined();
    
    // Soul: 6 -> 6
    expect(calc.soul).toBe(6);
    expect(calc.soulComposite).toBe("6");
    
    // Path: 0+6+0+5+1+9+8+6 = 35 -> 8
    expect(calc.path).toBe(8);
    expect(calc.pathComposite).toBe("35/8");
    
    // Direction: Soul (6) + Path Sum (35) = 41 -> 5
    expect(calc.direction).toBe(5);
    expect(calc.directionComposite).toBe("41/5");
    
    // Expression: Day (6) + Month (5) = 11 -> 11
    expect(calc.expression).toBe(11);
    expect(calc.expressionComposite).toBe("11");
    
    // Result: Soul (6) + Path (35) + Direction (41) = 82 -> 10 -> 1
    expect(calc.result).toBe(1);
    expect(calc.resultComposite).toBe("82/10/1");

    // Individuality & Matrix Anatomy extensions
    expect(calc.birthDayNumber).toBe(6);
    expect(calc.personalYear).toBeGreaterThanOrEqual(1);
    expect(calc.personalYear).toBeLessThanOrEqual(9);
    expect(calc.matrixAnalysis).toBeDefined();
    expect(calc.matrixAnalysis?.workingNumbers.rc1).toBe(35);
    expect(calc.matrixAnalysis?.workingNumbers.rc2).toBe(8);
  });

  it('distinguishes birth days 1, 10, 19, and 28 with unique composite paths while sharing Soul 1', () => {
    const c1 = calculateDigitalCode("01.05.1990");
    const c10 = calculateDigitalCode("10.05.1990");
    const c19 = calculateDigitalCode("19.05.1990");
    const c28 = calculateDigitalCode("28.05.1990");

    expect(c1.soul).toBe(1);
    expect(c10.soul).toBe(1);
    expect(c19.soul).toBe(1);
    expect(c28.soul).toBe(1);

    expect(c1.soulComposite).toBe("1");
    expect(c10.soulComposite).toBe("10/1");
    expect(c19.soulComposite).toBe("19/10/1");
    expect(c28.soulComposite).toBe("28/10/1");
  });
});
