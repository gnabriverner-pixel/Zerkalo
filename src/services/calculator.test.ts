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
  });
});
