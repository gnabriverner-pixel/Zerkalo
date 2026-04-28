// src/services/calculator.ts
// The Core Mathematical Engine for the Vyazemsky System

import { CalculationResult } from '../types';

/**
 * Reduces a number to a single digit, unless it's a master number (11, 22, 33).
 * Returns both the final digit and the composite string (e.g., "35/8").
 */
function reduceNumber(num: number): { value: number; composite: string } {
  if (num < 10) return { value: num, composite: num.toString() };
  
  let current = num;
  let steps = [current];
  
  while (current >= 10 && current !== 11 && current !== 22 && current !== 33) {
    const sum = current.toString().split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
    steps.push(sum);
    current = sum;
  }

  // If it reduced to 10, it goes to 1
  if (current === 10) {
    steps.push(1);
    current = 1;
  }

  return {
    value: current,
    composite: steps.join('/')
  };
}

/**
 * Calculates the 5 Main Numbers and the Matrix based on the Vyazemsky System.
 * @param dateString Format: "DD.MM.YYYY"
 */
export function calculateDigitalCode(dateString: string): CalculationResult {
  const [dayStr, monthStr, yearStr] = dateString.split('.');
  
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  // 1. Soul Number (ЧДш)
  const soulCalc = reduceNumber(day);

  // 2. Path Number (ЧП)
  const fullDateSum = dateString.replace(/\./g, '').split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
  const pathCalc = reduceNumber(fullDateSum);

  // 3. Direction Number (ЧН)
  // Formula: Soul (Base) + Path (Composite/Full Sum)
  const directionSum = soulCalc.value + fullDateSum;
  const directionCalc = reduceNumber(directionSum);

  // 4. Expression Number (ЧВ)
  // Formula: Day + Month
  const expressionSum = day + month;
  const expressionCalc = reduceNumber(expressionSum);

  // 5. Result Number (ЧРз)
  // Formula: Soul (Base) + Path (Composite) + Direction (Composite)
  const resultSum = soulCalc.value + fullDateSum + directionSum;
  const resultCalc = reduceNumber(resultSum);

  // Matrix Calculation
  // RC1 = fullDateSum
  // RC2 = sum of digits of RC1
  const rc1 = fullDateSum;
  const rc2 = rc1.toString().split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  
  // RC3 = RC1 - (first significant digit of day * 2)
  const firstSignificantDayDigit = parseInt(dayStr.replace(/^0+/, '')[0], 10);
  const rc3 = rc1 - (firstSignificantDayDigit * 2);
  
  // RC4 = sum of digits of RC3
  const rc4 = Math.abs(rc3).toString().split('').reduce((acc, d) => acc + parseInt(d, 10), 0);

  // Build Base Matrix (Only Date)
  const baseMatrixStr = dateString.replace(/\./g, '');
  const baseMatrix: Record<string, number> = {
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '0': 0
  };
  for (const char of baseMatrixStr) {
    if (baseMatrix[char] !== undefined) {
      baseMatrix[char]++;
    }
  }

  // Build Detailed Matrix (Date + RC1, RC2, RC3, RC4)
  const detailedMatrixStr = `${dateString.replace(/\./g, '')}${rc1}${rc2}${rc3}${rc4}`;
  const detailedMatrix: Record<string, number> = {
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '0': 0
  };
  for (const char of detailedMatrixStr) {
    if (detailedMatrix[char] !== undefined) {
      detailedMatrix[char]++;
    }
  }

  return {
    soul: soulCalc.value,
    soulComposite: soulCalc.composite,
    path: pathCalc.value,
    pathComposite: pathCalc.composite,
    direction: directionCalc.value,
    directionComposite: directionCalc.composite,
    expression: expressionCalc.value,
    expressionComposite: expressionCalc.composite,
    result: resultCalc.value,
    resultComposite: resultCalc.composite,
    baseMatrix,
    detailedMatrix
  };
}
