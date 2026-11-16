// src/services/calculator.ts
// The Core Mathematical Engine for the Vyazemsky System (Canon + Matrix Anatomy + Personal Year)

import { CalculationResult, MatrixAnalysis, MatrixLine } from '../types';

/**
 * Reduces a number to a single digit, unless it's a master number (11, 22, 33).
 * Returns both the final digit and the composite string (e.g., "35/8").
 */
function reduceNumber(num: number): { value: number; composite: string } {
  if (num < 10) return { value: num, composite: num.toString() };
  
  let current = num;
  const steps = [current];
  
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
 * Reduces any number strictly to 1–9 for Personal Year cycle
 */
function reduceToSingleDigit1To9(num: number): { value: number; composite: string } {
  if (num < 10) return { value: num, composite: num.toString() };
  let current = num;
  const steps = [current];
  while (current >= 10) {
    const sum = current.toString().split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
    steps.push(sum);
    current = sum;
  }
  return {
    value: current || 1,
    composite: steps.join('/')
  };
}

const MATRIX_DIGIT_META: Record<string, { quality: string; peakMeaning: string; voidMeaning: string }> = {
  '1': {
    quality: 'Характер, воля и голос «Я» (Солнце)',
    peakMeaning: 'Мощный запас личной инициативы, автономности и способности держать удар.',
    voidMeaning: 'Свобода от жесткого эгоцентризма; воля включается мягко, через интерес и внутреннее согласие.'
  },
  '2': {
    quality: 'Энергия контакта, дыхание и чуткость (Луна)',
    peakMeaning: 'Высокая плотность жизненной энергии, магнетизм в общении и тонкое считывание среды.',
    voidMeaning: 'Бережное отношение к личному пространству; важно регулярно пополнять ресурс через тишину, природу и движение.'
  },
  '3': {
    quality: 'Познание, интерес и структура мысли (Юпитер)',
    peakMeaning: 'Богатый инструментарий знаний, быстрый синтез идей и талант к творческому конструированию.',
    voidMeaning: 'Свобода от чужих догм; вы усваиваете только то знание, которое прошло проверку вашим собственным опытом.'
  },
  '4': {
    quality: 'Тело, устойчивость и земной каркас (Раху)',
    peakMeaning: 'Природная физическая и организационная выносливость, умение держать форму и порядок.',
    voidMeaning: 'Гибкость вместо жестких рамок; устойчивость приходит не через принуждение, а через ритм и любовь к своему делу.'
  },
  '5': {
    quality: 'Логика, мост речи и интуиция формы (Меркурий)',
    peakMeaning: 'Точность формулировок, аналитическая цепкость и дар соединять несоединимое.',
    voidMeaning: 'Мышление образами и метафорами поверх сухих схем; вы ищете свой собственный, нестандартный путь понимания.'
  },
  '6': {
    quality: 'Мастерство рук, ценность и эстетика (Венера)',
    peakMeaning: 'Врождённое чувство мастерства, умение созидать плотную материальную ценность и качество.',
    voidMeaning: 'Ориентация на смыслы и идеи больше, чем на рутинное ремесло; важно сознательно доводить задуманное до земной формы.'
  },
  '7': {
    quality: 'Поток интуиции и доверие миру (Кету)',
    peakMeaning: 'Сильный внутренний навигатор, способность оказываться в нужное время в нужном месте и слышать глубину.',
    voidMeaning: 'Свобода самому выстраивать свою траекторию; интуиция раскрывается через осознанное наблюдение и честность с собой.'
  },
  '8': {
    quality: 'Закон, ответственность и чувство меры (Сатурн)',
    peakMeaning: 'Глубокое чувство долга, справедливости и способность удерживать масштабные обязательства.',
    voidMeaning: 'Отсутствие давящего чувства вины; ответственность формируется из свободного выбора, а не из страха нарушить правило.'
  },
  '9': {
    quality: 'Память, масштаб цели и яснознание (Марс)',
    peakMeaning: 'Объёмная память, дальновидность и способность удерживать в фокусе большие цели.',
    voidMeaning: 'Умение жить в настоящем моменте, не перегружая себя прошлым; важно фиксировать главные цели письменно.'
  }
};

const MATRIX_LINES_CONFIG: {
  id: string;
  name: string;
  digits: [string, string, string];
  strongMeaning: string;
  moderateMeaning: string;
}[] = [
  {
    id: 'purpose',
    name: 'Стрела Целеустремлённости (1 · 4 · 7)',
    digits: ['1', '4', '7'],
    strongMeaning: 'Выраженная способность ставить перед собой ясные цели, опираться на твёрдый план и двигаться к результату.',
    moderateMeaning: 'Гибкое целеполагание: вы способны корректировать маршрут по ходу движения.'
  },
  {
    id: 'family',
    name: 'Линия Союза и Среды (2 · 5 · 8)',
    digits: ['2', '5', '8'],
    strongMeaning: 'Высокая потребность в надёжном тыле, глубоких человеческих связях, доме и верности слову.',
    moderateMeaning: 'Гармоничный баланс между автономией и привязанностью к близкому кругу.'
  },
  {
    id: 'stability',
    name: 'Линия Уклада и Основательности (3 · 6 · 9)',
    digits: ['3', '6', '9'],
    strongMeaning: 'Цените прочность, качество, проверенные знания и фундаментальный подход к жизни.',
    moderateMeaning: 'Легко обновляете привычки и не боитесь менять устоявшийся уклад ради развития.'
  },
  {
    id: 'self_esteem',
    name: 'Столп Личного Стержня (1 · 2 · 3)',
    digits: ['1', '2', '3'],
    strongMeaning: 'Ясное ощущение собственной ценности, инициативности и способности заявить о себе миру.',
    moderateMeaning: 'Самооценка опирается на конкретные дела и живой отклик мира.'
  },
  {
    id: 'material',
    name: 'Столп Материальной Опоры (4 · 5 · 6)',
    digits: ['4', '5', '6'],
    strongMeaning: 'Сильная практическая хватка, умение обеспечивать устойчивость и превращать труд в достаток.',
    moderateMeaning: 'Материальный ресурс приходит тогда, когда дело наполнено для вас живым интересом.'
  },
  {
    id: 'talent',
    name: 'Столп Творческого Масштаба (7 · 8 · 9)',
    digits: ['7', '8', '9'],
    strongMeaning: 'Высокий калибр талантов, интуитивного понимания законов жизни и влияния на большие процессы.',
    moderateMeaning: 'Талант раскрывается постепенно через осознанную практику и личный опыт.'
  },
  {
    id: 'spirituality',
    name: 'Диагональ Смысла и Вдохновения (1 · 5 · 9)',
    digits: ['1', '5', '9'],
    strongMeaning: 'Сильная внутренняя ось смыслов: вам жизненно важно понимать высшую цель того, что вы делаете.',
    moderateMeaning: 'Здоровое равновесие между высокими идеалами и простыми земными задачами.'
  },
  {
    id: 'temperament',
    name: 'Диагональ Чувствительности и Вкуса (3 · 5 · 7)',
    digits: ['3', '5', '7'],
    strongMeaning: 'Яркий темперамент, тонкое восприятие красоты, страстность в любимом деле и живой отклик.',
    moderateMeaning: 'Спокойный, ровный внутренний ритм и избирательность в чувствах.'
  }
];

function buildMatrixAnalysis(
  detailedMatrix: Record<string, number>,
  rc1: number,
  rc2: number,
  rc3: number,
  rc4: number
): MatrixAnalysis {
  const peaks: MatrixAnalysis['peaks'] = [];
  const voids: MatrixAnalysis['voids'] = [];

  for (let d = 1; d <= 9; d++) {
    const key = d.toString();
    const count = detailedMatrix[key] || 0;
    const meta = MATRIX_DIGIT_META[key];

    if (count >= 2 && meta) {
      peaks.push({
        digit: key,
        count,
        quality: meta.quality,
        meaning: meta.peakMeaning
      });
    } else if (count === 0 && meta) {
      voids.push({
        digit: key,
        quality: meta.quality,
        meaning: meta.voidMeaning
      });
    }
  }

  // Sort peaks by highest count first
  peaks.sort((a, b) => b.count - a.count);

  const zerosCount = detailedMatrix['0'] || 0;
  let zerosMeaning = 'В вашей формуле числа звучат прямо и предметно, без обнуляющих перепадов.';
  if (zerosCount === 1) {
    zerosMeaning = 'Один Ноль в карте работает как природный резонатор: он усиливает стоящее рядом число и даёт способность вовремя обновлять взгляд на жизнь.';
  } else if (zerosCount >= 2) {
    zerosMeaning = `В вашей карте ${zerosCount} нуля — это мощные линзы пространства (Шунья). Они дают большой масштаб потенциала, нестандартную глубину и способность обнулять отжившие сценарии и начинать заново на более высоком витке.`;
  }

  const activeLines: MatrixLine[] = [];
  for (const lineCfg of MATRIX_LINES_CONFIG) {
    const c1 = detailedMatrix[lineCfg.digits[0]] || 0;
    const c2 = detailedMatrix[lineCfg.digits[1]] || 0;
    const c3 = detailedMatrix[lineCfg.digits[2]] || 0;
    const totalCount = c1 + c2 + c3;

    if (c1 > 0 && c2 > 0 && c3 > 0) {
      activeLines.push({
        id: lineCfg.id,
        name: lineCfg.name,
        digits: lineCfg.digits,
        totalCount,
        strength: totalCount >= 5 ? 'strong' : 'moderate',
        meaning: totalCount >= 5 ? lineCfg.strongMeaning : lineCfg.moderateMeaning
      });
    }
  }

  // Sort active lines by density
  activeLines.sort((a, b) => b.totalCount - a.totalCount);

  return {
    peaks,
    voids,
    zerosCount,
    zerosMeaning,
    activeLines,
    workingNumbers: { rc1, rc2, rc3, rc4 }
  };
}

/**
 * Calculates the 5 Main Numbers, Personal Year, and Matrix based on the Vyazemsky System.
 * @param dateString Format: "DD.MM.YYYY"
 */
export function calculateDigitalCode(dateString: string): CalculationResult {
  const safeDateStr = typeof dateString === 'string' ? dateString : '';
  const [dayStr = '01', monthStr = '01', yearStr = '2000'] = safeDateStr.split('.');
  
  const day = parseInt(dayStr, 10) || 1;
  const month = parseInt(monthStr, 10) || 1;
  const year = parseInt(yearStr, 10) || 2000;

  // 1. Soul Number (ЧДш)
  const soulCalc = reduceNumber(day);

  // 2. Path Number (ЧП)
  const fullDateSum = safeDateStr.replace(/\./g, '').split('').reduce((acc, digit) => acc + (parseInt(digit, 10) || 0), 0) || 1;
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

  // Personal Year (Личный год на текущий реальный год)
  const currentYear = new Date().getFullYear();
  const pyDigitsStr = `${dayStr.padStart(2, '0')}${monthStr.padStart(2, '0')}${currentYear}`;
  const pySum = pyDigitsStr.split('').reduce((acc, d) => acc + (parseInt(d, 10) || 0), 0);
  const personalYearCalc = reduceToSingleDigit1To9(pySum);

  // Matrix Calculation
  // RC1 = fullDateSum
  // RC2 = sum of digits of RC1
  const rc1 = fullDateSum;
  const rc2 = rc1.toString().split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  
  // RC3 = RC1 - (first significant digit of day * 2)
  const nonZeroDayDigits = dayStr.replace(/^0+/, '');
  const firstSignificantDayDigit = parseInt(nonZeroDayDigits[0] || '1', 10) || 1;
  const rc3 = rc1 - (firstSignificantDayDigit * 2);
  
  // RC4 = sum of digits of RC3
  const rc4 = Math.abs(rc3).toString().split('').reduce((acc, d) => acc + parseInt(d, 10), 0);

  // Build Base Matrix (Only Date)
  const baseMatrixStr = safeDateStr.replace(/\./g, '');
  const baseMatrix: Record<string, number> = {
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '0': 0
  };
  for (const char of baseMatrixStr) {
    if (baseMatrix[char] !== undefined) {
      baseMatrix[char]++;
    }
  }

  // Build Detailed Matrix (Date + RC1, RC2, RC3, RC4)
  const detailedMatrixStr = `${safeDateStr.replace(/\./g, '')}${rc1}${rc2}${Math.abs(rc3)}${rc4}`;
  const detailedMatrix: Record<string, number> = {
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '0': 0
  };
  for (const char of detailedMatrixStr) {
    if (detailedMatrix[char] !== undefined) {
      detailedMatrix[char]++;
    }
  }

  const matrixAnalysis = buildMatrixAnalysis(detailedMatrix, rc1, rc2, rc3, rc4);

  return {
    soul: soulCalc.value,
    soulComposite: soulCalc.composite,
    birthDayNumber: day,
    path: pathCalc.value,
    pathComposite: pathCalc.composite,
    direction: directionCalc.value,
    directionComposite: directionCalc.composite,
    expression: expressionCalc.value,
    expressionComposite: expressionCalc.composite,
    result: resultCalc.value,
    resultComposite: resultCalc.composite,
    personalYear: personalYearCalc.value,
    personalYearComposite: personalYearCalc.composite,
    baseMatrix,
    detailedMatrix,
    matrixAnalysis
  };
}
