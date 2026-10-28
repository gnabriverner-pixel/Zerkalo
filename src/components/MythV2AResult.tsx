import React from 'react';
import type { StoryInputs, ApiResponse } from '../types';
import { EmblemPlate } from '../art/emblem';
import { MYTH_V2A_QUESTIONS } from '../services/mythQuestionsV2A';

export type MythResult = NonNullable<ApiResponse['story_result']>;

export const V2A_FIXED_LINE = 'Если вы не узнали себя — это тоже ответ. Сказка — образ, не биография.';

/** Writer v2a stories carry the «из чего сделана сказка» table plus meaning, question and practice. */
export const isV2AResult = (r: MythResult) => Array.isArray(r.made_of) && r.made_of.length > 0;

/**
 * The screen of a finished Personal Myth in mode A: title, the three answers, the tale, the «made of» table,
 * meaning, question, 7-day practice and the «if you did not recognise yourself» line.
 * One component for the real screen and for the public example, so they cannot drift apart.
 */
export function MythV2AResultBody({ result, inputs, afterStory }: { result: MythResult; inputs: StoryInputs; afterStory?: React.ReactNode }) {
  return (
    <>
      <div className="text-center w-full max-w-2xl mx-auto pt-4">
        <EmblemPlate planet={7} variant="obsidian" size={64} showNumber={false} showLabel={false} className="mx-auto mb-6" />
        <span className="text-[13px] tracking-[0.3em] uppercase text-purple-300/80 font-sans font-medium block mb-2">
          Личный Миф · Художественная сцена
        </span>
        <h1 className="font-serif text-3xl sm:text-5xl text-stone-100 mb-4 font-light tracking-tight" data-testid="myth-title">
          {result.title}
        </h1>
      </div>

      <div className="w-full max-w-[var(--measure)] mx-auto border-t border-white/10 pt-8" data-testid="myth-answers">
        <span className="text-[13px] uppercase font-sans font-medium tracking-[0.25em] text-[var(--color-antique-gold)]/80 block mb-4">
          Что вы рассказали в трёх ответах
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MYTH_V2A_QUESTIONS.map(q => (
            <div key={q.key}>
              <span className="text-[13px] uppercase text-stone-400 font-sans font-medium block mb-1">{q.tag.replace(' / 03', '')}</span>
              <p className="text-xs text-stone-300 font-serif italic">«{inputs[q.key] || '—'}»</p>
            </div>
          ))}
        </div>
      </div>

      <article className="w-full max-w-[calc(var(--measure)+6rem)] mx-auto bg-[#EFE5D3] px-6 py-10 sm:px-12 sm:py-14 rounded-xs">
        <div className="mb-8 flex items-center justify-between border-b border-[#6B5638]/20 pb-4 text-[13px] uppercase tracking-[0.25em] text-[#6B5638] font-sans font-medium">
          <span>Личный миф</span>
          <span>Чернила · ваши три ответа</span>
        </div>
        <div className="font-serif text-[1.3125rem] sm:text-[1.4375rem] leading-[1.68] text-[#231c14] space-y-[1.1em] font-normal max-w-[var(--measure)] mx-auto" data-testid="myth-story">
          {result.story.split('\n\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
        <div data-testid="myth-v2a-after-story" className="mt-14 pt-10 border-t border-[#6B5638]/25 max-w-[var(--measure)] mx-auto space-y-12 text-[#231c14]">
          <section data-testid="myth-made-of">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#6B5638] font-sans font-medium mb-4">Из чего сделана сказка</h2>
            <table className="w-full text-left border-collapse font-serif text-[1.125rem] leading-[1.6]">
              <thead className="hidden sm:table-header-group">
                <tr className="text-[12px] uppercase tracking-[0.2em] text-[#6B5638] font-sans font-medium">
                  <th scope="col" className="w-1/2 pb-2 pr-4 font-normal">Образ сказки</th>
                  <th scope="col" className="w-1/2 pb-2 font-normal">Откуда в ваших ответах</th>
                </tr>
              </thead>
              <tbody>
                {result.made_of!.map((row, idx) => (
                  <tr key={idx} className="block sm:table-row border-t border-[#6B5638]/15 py-3 sm:py-0">
                    <td className="block sm:table-cell sm:py-3 sm:pr-4 sm:align-top font-medium">{row.element}</td>
                    <td className="block sm:table-cell sm:py-3 sm:align-top italic text-[#4a3d2b]">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section data-testid="myth-meaning">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#6B5638] font-sans font-medium mb-3">Что это может значить сейчас</h2>
            <p className="font-serif text-[1.1875rem] leading-[1.68]">{(result.meaning ?? []).join(' ')}</p>
          </section>
          <section data-testid="myth-question">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#6B5638] font-sans font-medium mb-3">Вопрос</h2>
            <p className="font-serif italic text-[1.3125rem] leading-[1.6]">«{result.journal_question}»</p>
          </section>
          <section data-testid="myth-practice">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#6B5638] font-sans font-medium mb-3">Практика на 7 дней</h2>
            <p className="font-serif text-[1.1875rem] leading-[1.68]">{result.one_step}</p>
          </section>
          <p data-testid="myth-fixed-line" className="text-[0.8125rem] text-[#5a4a33] leading-relaxed">{V2A_FIXED_LINE}</p>
          {afterStory}
        </div>
      </article>
    </>
  );
}
