import type { StoryInputs } from '../types';

/**
 * The three questions of the Personal Myth writer v2a, in the wording of contract v2 section 1.
 * Storage keys are unchanged (no migration): q1 = situation, q3 = moment of aliveness, q4 = what is wanted more;
 * q2 (the former "image of the state") is stored as an empty string. Shared by the questionnaire UI and the writer's user message.
 */
export interface MythV2AQuestion {
  key: keyof StoryInputs;
  /** Label used in the writer's user message (contract section 1 wording). */
  label: string;
  tag: string;
  title: string;
  placeholder: string;
  orbNumber: number;
}

export const MYTH_V2A_QUESTIONS: ReadonlyArray<MythV2AQuestion> = [
  { key: 'q1', label: 'Что сейчас происходит (ситуация, о которой хочется понять)', tag: '01 / 03 · Ситуация', orbNumber: 4,
    title: 'Что сейчас происходит?',
    placeholder: 'Ситуация, о которой хочется понять. Свободно, от одного до пяти предложений.' },
  { key: 'q3', label: 'Где вы недавно были на своём месте (момент, когда было живо)', tag: '02 / 03 · Живой момент', orbNumber: 5,
    title: 'Где вы недавно были на своём месте?',
    placeholder: 'Момент, когда было живо. Не вспоминается — так и напишите: «не помню».' },
  { key: 'q4', label: 'Чего хочется больше', tag: '03 / 03 · Чего хочется', orbNumber: 6,
    title: 'Чего хочется больше?',
    placeholder: 'Одно слово или фраза.' },
];
