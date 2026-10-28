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
        <span className="text-[13px] tracking-[0.3em] uppercase text-purple-300/80 font-mono block mb-2">
          Личный Миф · Художественная сцена
        </span>
        <h1 className="font-serif text-3xl sm:text-5xl text-stone-100 mb-4 font-light tracking-tight" data-testid="myth-title">
          {result.title}
        </h1>
      </div>

      <div className="w-full bg-[#0D121D]/70 border border-white/[0.08] p-6 sm:p-8 rounded-xs" data-testid="myth-answers">
        <span className="text-[13px] uppercase font-mono tracking-[0.25em] text-[var(--color-antique-gold)]/80 block mb-4">
          Что вы рассказали в трёх ответах
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MYTH_V2A_QUESTIONS.map(q => (
            <div key={q.key}>
              <span className="text-[13px] uppercase text-stone-400 font-mono block mb-1">{q.tag.replace(' / 03', '')}</span>
              <p className="text-xs text-stone-300 font-serif italic">«{inputs[q.key] || '—'}»</p>
            </div>
          ))}
        </div>
      </div>

      <article className="w-full bg-[#EFE5D3] border border-[#D1B98D]/50 p-8 sm:p-12 rounded-xs shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
        <div className="mb-8 flex items-center justify-between border-b border-[#7B6545]/20 pb-4 text-[13px] uppercase tracking-[0.25em] text-[#7B6545] font-mono">
          <span>Личный миф</span>
          <span>Чернила · ваши три ответа</span>
        </div>
        <div className="font-serif text-lg sm:text-[21px] leading-[2] text-[#282019] space-y-8 font-normal max-w-2xl mx-auto tracking-[0.015em]" data-testid="myth-story">
          {result.story.split('\n\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
        <div data-testid="myth-v2a-after-story" className="mt-12 pt-8 border-t border-[#7B6545]/25 max-w-2xl mx-auto space-y-10 text-[#282019]">
          <section data-testid="myth-made-of">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#7B6545] font-mono mb-4">Из чего сделана сказка</h2>
            <table className="w-full text-left border-collapse font-serif text-base leading-relaxed">
              <thead className="hidden sm:table-header-group">
                <tr className="text-[12px] uppercase tracking-[0.2em] text-[#7B6545] font-mono">
                  <th scope="col" className="w-1/2 pb-2 pr-4 font-normal">Образ сказки</th>
                  <th scope="col" className="w-1/2 pb-2 font-normal">Откуда в ваших ответах</th>
                </tr>
              </thead>
              <tbody>
                {result.made_of!.map((row, idx) => (
                  <tr key={idx} className="block sm:table-row border-t border-[#7B6545]/20 py-3 sm:py-0">
                    <td className="block sm:table-cell sm:py-3 sm:pr-4 sm:align-top font-medium">{row.element}</td>
                    <td className="block sm:table-cell sm:py-3 sm:align-top italic text-[#4a3d2b]">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section data-testid="myth-meaning">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#7B6545] font-mono mb-3">Что это может значить сейчас</h2>
            <p className="font-serif text-lg leading-[1.8]">{(result.meaning ?? []).join(' ')}</p>
          </section>
          <section data-testid="myth-question">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#7B6545] font-mono mb-3">Вопрос</h2>
            <p className="font-serif italic text-xl leading-[1.7]">«{result.journal_question}»</p>
          </section>
          <section data-testid="myth-practice">
            <h2 className="text-[13px] uppercase tracking-[0.25em] text-[#7B6545] font-mono mb-3">Практика на 7 дней</h2>
            <p className="font-serif text-lg leading-[1.8]">{result.one_step}</p>
          </section>
          <p data-testid="myth-fixed-line" className="text-xs text-[#6b5a40] leading-relaxed">{V2A_FIXED_LINE}</p>
          {afterStory}
        </div>
      </article>
    </>
  );
}
