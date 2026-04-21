export interface NumberResult {
  base: number;
  full: string;
  isMaster: boolean;
}

function sumDigits(n: number | string): number {
  return String(n).split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
}

export function reduceToSingleOrMaster(num: number): NumberResult {
  if (num >= 1 && num <= 9) return { base: num, full: `${num}`, isMaster: false };
  if (num === 11 || num === 22 || num === 33) {
    return { base: sumDigits(num), full: `${num}/${sumDigits(num)}`, isMaster: true };
  }
  
  let current = num;
  let path = [current];
  
  while (current > 9 && current !== 11 && current !== 22 && current !== 33) {
    current = sumDigits(current);
    path.push(current);
    if (current === 11 || current === 22 || current === 33) {
      path.push(sumDigits(current));
      return { base: sumDigits(current), full: path.join('/'), isMaster: true };
    }
  }
  
  if (path.length > 1) {
    if (path.length > 2) {
      return { base: path[path.length - 1], full: `${path[0]}/${path[path.length - 1]}`, isMaster: false };
    }
    return { base: path[path.length - 1], full: path.join('/'), isMaster: false };
  }
  
  return { base: current, full: `${current}`, isMaster: false };
}

export function calculateCHU(day: number): NumberResult {
  if (day >= 1 && day <= 9) return { base: day, full: `${day}`, isMaster: false };
  if (day === 10) return { base: 1, full: `10/1`, isMaster: false };
  if (day === 11) return { base: 2, full: `11/2`, isMaster: true };
  if (day === 12) return { base: 3, full: `12/3`, isMaster: false };
  if (day === 13) return { base: 4, full: `13/4`, isMaster: false };
  if (day === 14) return { base: 5, full: `14/5`, isMaster: false };
  if (day === 15) return { base: 6, full: `15/6`, isMaster: false };
  if (day === 16) return { base: 7, full: `16/7`, isMaster: false };
  if (day === 17) return { base: 8, full: `17/8`, isMaster: false };
  if (day === 18) return { base: 9, full: `18/9`, isMaster: false };
  if (day === 19) return { base: 1, full: `19/1`, isMaster: false };
  if (day === 20) return { base: 2, full: `20/2`, isMaster: false };
  if (day === 21) return { base: 3, full: `21/3`, isMaster: false };
  if (day === 22) return { base: 4, full: `22/4`, isMaster: true };
  if (day === 23) return { base: 5, full: `23/5`, isMaster: false };
  if (day === 24) return { base: 6, full: `24/6`, isMaster: false };
  if (day === 25) return { base: 7, full: `25/7`, isMaster: false };
  if (day === 26) return { base: 8, full: `26/8`, isMaster: false };
  if (day === 27) return { base: 9, full: `27/9`, isMaster: false };
  if (day === 28) return { base: 1, full: `28/1`, isMaster: false };
  if (day === 29) return { base: 2, full: `29/11/2`, isMaster: true };
  if (day === 30) return { base: 3, full: `30/3`, isMaster: false };
  if (day === 31) return { base: 4, full: `31/4`, isMaster: false };
  return { base: 0, full: '0', isMaster: false };
}

export function calculateCHV(dateStr: string): NumberResult {
  const digits = dateStr.replace(/\D/g, '');
  const sum = sumDigits(digits);
  return reduceToSingleOrMaster(sum);
}

export function calculateCHD(month: number): NumberResult {
  if (month === 11) return { base: 2, full: `11/2`, isMaster: true };
  if (month === 10) return { base: 1, full: `10/1`, isMaster: false };
  if (month === 12) return { base: 3, full: `12/3`, isMaster: false };
  return { base: month, full: `${month}`, isMaster: false };
}

export function calculateCHR(year: number): NumberResult {
  const sum = sumDigits(year);
  return reduceToSingleOrMaster(sum);
}

export function calculateCHI(chuBase: number, chvBase: number): NumberResult {
  const sum = chuBase + chvBase;
  return reduceToSingleOrMaster(sum);
}

export function calculateLG(day: number, month: number, currentYear: number): number {
  const sum = sumDigits(day) + sumDigits(month) + sumDigits(currentYear);
  return reduceToSingleOrMaster(sum).base;
}

export function calculateLM(lg: number, currentMonth: number): number {
  const sum = lg + sumDigits(currentMonth);
  return reduceToSingleOrMaster(sum).base;
}

export function calculateMatrix(dateStr: string) {
  const digits = dateStr.replace(/\D/g, '');
  const firstNonZero = parseInt(digits.split('').find(d => d !== '0') || '0', 10);
  
  const rch1 = sumDigits(digits);
  const rch2 = sumDigits(rch1);
  const rch3 = Math.abs(rch1 - (firstNonZero * 2));
  const rch4 = sumDigits(rch3);
  
  const allDigits = digits + String(rch1) + String(rch2) + String(rch3) + String(rch4);
  
  const matrix: Record<number, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
  };
  
  for (const char of allDigits) {
    const num = parseInt(char, 10);
    if (num >= 1 && num <= 9) {
      matrix[num]++;
    }
  }
  
  return matrix;
}

const CYRILLIC_MAP: Record<string, number> = {
  'А': 1, 'Б': 2, 'В': 3, 'Г': 4, 'Д': 5, 'Е': 6, 'Ж': 7, 'З': 8, 'И': 9,
  'Й': 1, 'К': 2, 'Л': 3, 'М': 4, 'Н': 5, 'О': 6, 'П': 7, 'Р': 8, 'С': 9,
  'Т': 1, 'У': 2, 'Ф': 3, 'Х': 4, 'Ц': 5, 'Ч': 6, 'Ш': 7, 'Щ': 8, 'Ъ': 9,
  'Ы': 1, 'Ь': 2, 'Э': 3, 'Ю': 4, 'Я': 5, 'Ё': 6
};

export function calculateWord(word: string): NumberResult | null {
  if (!word) return null;
  const upper = word.toUpperCase().replace(/[^А-ЯЁ]/g, '');
  if (!upper) return null;
  
  let sum = 0;
  for (const char of upper) {
    if (CYRILLIC_MAP[char]) {
      sum += CYRILLIC_MAP[char];
    }
  }
  
  return reduceToSingleOrMaster(sum);
}
