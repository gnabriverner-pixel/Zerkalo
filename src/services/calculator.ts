// src/services/calculator.ts
// The Core Mathematical Engine for the Vedic Numerology System (Protocol Calculation v1)

import { CalculationResult } from '../types';
import { validateBirthDate } from './birthDate';

/**
 * Verbose reduction of a number to a single digit (1..9), preserving reduction history.
 * Example: 82 -> [82, 10, 1], composite: "82/10/1", value: 1
 * Example: 29 -> [29, 11, 2], composite: "29/11/2", value: 2
 * Example: 33 -> [33, 6], composite: "33/6", value: 6
 */
export function reduceVerbously(num: number): { value: number; composite: string; history: number[] } {
  const safeNum = Math.max(0, Math.round(num) || 0);
  if (safeNum === 0) {
    return { value: 0, composite: '0', history: [0] };
  }

  let current = safeNum;
  const history: number[] = [current];

  while (current > 9) {
    current = current
      .toString()
      .split('')
      .reduce((acc, digit) => acc + parseInt(digit, 10), 0);
    history.push(current);
  }

  return {
    value: current,
    composite: history.join('/'),
    history
  };
}

/**
 * Calculates the 5 Main Numbers (ЧУ, ЧВ, ЧД, ЧР, ЧИ) and the Matrices (Базовая и Детальная)
 * strictly conforming to Protocol Calculation v1.
 * 
 * @param dateString Format: "DD.MM.YYYY" (must be valid calendar date, 1900..today)
 * @throws Error on invalid or malformed dates (no silent fallbacks to 01.01.2000)
 */
export function calculateDigitalCode(dateString: string): CalculationResult {
  if (typeof dateString !== 'string' || !dateString.trim()) {
    throw new Error(`Invalid birth date: empty or non-string input. Expected DD.MM.YYYY.`);
  }

  const trimmed = dateString.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
    throw new Error(`Invalid birth date format: "${dateString}". Expected DD.MM.YYYY.`);
  }

  const [dayStr, monthStr, yearStr] = parts;
  const validation = validateBirthDate(dayStr, monthStr, yearStr);
  if (!validation.valid) {
    const msg = 'message' in validation ? validation.message : 'Invalid birth date';
    throw new Error(`Invalid birth date "${dateString}": ${msg}`);
  }

  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  // 1. Число Души / Число Ума (ЧДш / ЧУ)
  // Formula: Исходный день рождения, свернутый до 1..9
  const mindFull = day;
  const mindCalc = reduceVerbously(mindFull);

  // 2. Число Выражения (ЧВ)
  // Formula: сумма ЦИФР дня + сумма ЦИФР месяца -> сведение до 1..9
  const dayDigitsSum = dayStr.split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  const monthDigitsSum = monthStr.split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  const expressionFull = dayDigitsSum + monthDigitsSum;
  const expressionCalc = reduceVerbously(expressionFull);

  // 3. Число Пути / Число Действия (ЧП / ЧД)
  // Formula: сумма ВСЕХ цифр даты рождения
  const allDobDigits = trimmed
    .replace(/\./g, '')
    .split('')
    .map((d) => parseInt(d, 10))
    .filter((n) => !isNaN(n));
  const actionFull = allDobDigits.reduce((acc, digit) => acc + digit, 0);
  const actionCalc = reduceVerbously(actionFull);

  // 4. Число Направления / Число Реализации (ЧН / ЧР)
  // Formula: composite ЧУ (mindFull) + composite ЧД (actionFull)
  const realizationFull = mindFull + actionFull;
  const realizationCalc = reduceVerbously(realizationFull);

  // 5. Число Результата / Число Итога (ЧРз / ЧИ)
  // Formula: composite ЧУ (mindFull) + composite ЧД (actionFull) + composite ЧР (realizationFull)
  const outcomeFull = mindFull + actionFull + realizationFull;
  const outcomeCalc = reduceVerbously(outcomeFull);

  // 6. Базовая Матрица (Simple Matrix)
  // Подсчёт цифр 1..9 из даты рождения (0 строго исключен)
  const baseMatrix: Record<string, number> = {
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0
  };
  for (const digit of allDobDigits) {
    if (digit >= 1 && digit <= 9) {
      const key = digit.toString();
      baseMatrix[key]++;
    }
  }

  // 7. Детальная Матрица (Detailed Matrix)
  // Simple matrix + цифры composite ЧД (actionFull) + composite ЧР (realizationFull) + composite ЧИ (outcomeFull) (0 строго исключен)
  const detailedMatrix: Record<string, number> = { ...baseMatrix };
  const extraDigitsStr = `${actionFull}${realizationFull}${outcomeFull}`;
  for (const char of extraDigitsStr) {
    if (char >= '1' && char <= '9') {
      detailedMatrix[char]++;
    }
  }

  return {
    soul: mindCalc.value,
    soulComposite: mindCalc.composite,
    path: actionCalc.value,
    pathComposite: actionCalc.composite,
    direction: realizationCalc.value,
    directionComposite: realizationCalc.composite,
    expression: expressionCalc.value,
    expressionComposite: expressionCalc.composite,
    result: outcomeCalc.value,
    resultComposite: outcomeCalc.composite,
    baseMatrix,
    detailedMatrix
  };
}
