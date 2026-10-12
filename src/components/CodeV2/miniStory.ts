import type { CodeV2MiniStory } from '../../types';

export interface ReaderStory {
  title: string;
  paragraphs: string[];
  question: string;
}

/** Returns a story only when it is complete enough to show; otherwise null and the old card is used. */
export function readerStory(raw: CodeV2MiniStory | null | undefined, fallbackQuestion: string): ReaderStory | null {
  if (!raw || !Array.isArray(raw.paragraphs)) return null;
  const paragraphs = raw.paragraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map(p => p.trim());
  if (paragraphs.length === 0) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const question = typeof raw.question === 'string' && raw.question.trim() ? raw.question.trim() : fallbackQuestion;
  return { title, paragraphs, question };
}

/** Albert lines are written in advance and shown only at moments where the reading question changes. */
const NUMERAL: Record<number, string> = { 1: 'Единица', 2: 'Двойка', 3: 'Тройка', 4: 'Четвёрка', 5: 'Пятёрка', 6: 'Шестёрка', 7: 'Семёрка', 8: 'Восьмёрка', 9: 'Девятка' };
const LIGHT_OF: Record<number, string> = { 1: 'Солнца', 2: 'Луны', 3: 'Юпитера', 4: 'Раху', 5: 'Меркурия', 6: 'Венеры', 7: 'Кету', 8: 'Сатурна', 9: 'Марса' };

/** Fixed lead line for the card of a position (no model call). Returns undefined for unknown input. */
export function albertLead(position: string, energy: number): string | undefined {
  const n = NUMERAL[energy];
  const light = LIGHT_OF[energy];
  if (!n || !light) return undefined;
  const tie = `${n} связана с образом ${light}`;
  switch (position) {
    case 'soul': return `Начнём с комнаты, где можно побыть собой. Здесь мы смотрим на внутренние желания. В этом разборе: ${tie}.`;
    case 'expression': return `Теперь окно на улицу: что в ваших делах замечают другие. Здесь ${tie}.`;
    case 'path': return `Мастерская: здесь вы учитесь делать. В вашем разборе ${tie}.`;
    case 'direction': return `Теперь выйдем в общий зал. Здесь важно, кто рядом и как устроена жизнь вокруг вас. Здесь ${tie}.`;
    case 'result': return `И напоследок выйдем в сад за домом: посмотрим, что может вырасти из ваших дел. Здесь ${tie}.`;
    default: return undefined;
  }
}
