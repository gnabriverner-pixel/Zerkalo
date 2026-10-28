import type { PreviewStatus } from './freePreview';

/** One calm line about the free window, from the same /api/free-preview data as «Мои мифы». null when there is no active window or no end date. */
export function freeWindowLine(status: PreviewStatus | null | undefined): string | null {
  if (!status || !status.enabled || !status.active || !status.ends_at) return null;
  const date = new Date(status.ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
  return `Пробный доступ — бесплатно до ${date} включительно.`;
}
