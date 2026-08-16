export type BirthDateValidation =
  | { valid: true; formatted: string }
  | { valid: false; message: string };

export function validateBirthDate(day: string, month: string, year: string, today = new Date()): BirthDateValidation {
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return { valid: false, message: 'Введите дату полностью: ДД.ММ.ГГГГ' };
  }
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || y < 1900) {
    return { valid: false, message: 'Проверьте день, месяц и год' };
  }
  const candidate = new Date(y, m - 1, d);
  const isCalendarDate = candidate.getFullYear() === y && candidate.getMonth() === m - 1 && candidate.getDate() === d;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!isCalendarDate || candidate > todayStart) return { valid: false, message: 'Введите существующую дату рождения' };
  return { valid: true, formatted: `${day}.${month}.${year}` };
}
