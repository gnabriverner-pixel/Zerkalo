import React from 'react';

interface Props {
  observation: string;
  basisNumbers: string;
  basisPositions: string;
  practicalStep: string;
}

export function MeaningProvenance({
  observation,
  basisNumbers,
  basisPositions,
  practicalStep,
}: Props) {
  const stages = [
    {
      index: '01',
      label: 'Наблюдение',
      text: observation,
    },
    {
      index: '02',
      label: 'Основание',
      text: `${basisPositions}. Числовая запись: ${basisNumbers}.`,
    },
    {
      index: '03',
      label: 'Практическое следствие',
      text: practicalStep,
    },
  ];

  return (
    <section aria-labelledby="meaning-provenance-title" className="my-20 border-y border-[var(--border-soft)] py-12">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-[var(--color-antique-gold)]">
          Как читать вывод
        </p>
        <h3 id="meaning-provenance-title" className="font-serif text-2xl text-[var(--color-ink)] md:text-3xl">
          От наблюдения — к основанию — к действию
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          Зеркало не просит верить формулировке на слово. Смысл можно разложить на три проверяемых слоя.
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-px border border-[var(--border-soft)] bg-[var(--border-soft)] md:grid-cols-3">
        {stages.map((stage) => (
          <li key={stage.index} className="flex min-h-56 flex-col bg-[var(--color-surface)] p-7 md:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <span className="font-serif text-2xl text-[var(--color-antique-gold)]">{stage.index}</span>
              <span className="text-right text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-muted)]">
                {stage.label}
              </span>
            </div>
            <p className="font-serif text-base leading-relaxed text-[var(--color-graphite)] md:text-lg">
              {stage.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
