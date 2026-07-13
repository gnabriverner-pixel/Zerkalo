export function normalizeDateInputValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let normalized = value.replace(/[^\d]/g, '');
  if (normalized.length > 2) {
    normalized = `${normalized.substring(0, 2)}.${normalized.substring(2)}`;
  }
  if (normalized.length > 5) {
    normalized = `${normalized.substring(0, 5)}.${normalized.substring(5, 9)}`;
  }
  return normalized;
}
