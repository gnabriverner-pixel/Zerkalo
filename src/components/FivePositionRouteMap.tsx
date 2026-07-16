import React from 'react';

const POSITION_MEANINGS: Record<string, string> = {
  'Душа': 'что для вас важно изнутри',
  'Путь': 'как намерение переходит в действие',
  'Выражение': 'как потенциал становится видимым',
  'Направление': 'куда направляется усилие',
  'Результат': 'что эта связка способна собрать',
};

interface Props {
  numbers: string;
  positions: string;
}

function splitFormula(value: string): string[] {
  return value
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function FivePositionRouteMap({ numbers, positions }: Props) {
  const positionItems = splitFormula(positions);
  const numberItems = splitFormula(numbers);
  const items = positionItems.slice(0, 5).map((position, index) => ({
    position,
    number: numberItems[index] ?? '—',
    meaning: POSITION_MEANINGS[position] ?? 'одна из функций вашей общей формулы',
  }));

  if (items.length !== 5) return null;

  return (
    <section aria-labelledby="five-position-route-title" className="my-14">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <p className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-[var(--color-antique-gold)]">
          Пять позиций
        </p>
        <h3 id="five-position-route-title" className="font-serif text-2xl text-[var(--color-ink)] md:text-3xl">
          Не пять ярлыков, а один маршрут
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          Каждая позиция отвечает на свой человеческий вопрос. Число здесь — не имя человека, а краткая запись того, как работает конкретная часть маршрута.
        </p>
      </div>

      <ol className="relative grid grid-cols-1 gap-3 md:grid-cols-5 md:gap-2">
        <div
          aria-hidden="true"
          className="absolute left-[10%] right-[10%] top-8 hidden h-px bg-[var(--border-soft)] md:block"
        />
        {items.map((item, index) => (
          <li
            key={`${item.position}-${index}`}
            className="relative flex min-h-40 flex-col border border-[var(--border-soft)] bg-[var(--color-surface)] p-5 md:min-h-52 md:p-4"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-antique-gold)] bg-[var(--color-ivory)] text-xs text-[var(--color-antique-gold)]">
                {index + 1}
              </span>
              <span className="font-serif text-2xl text-[var(--color-ink)]" aria-label={`Число ${item.number}`}>
                {item.number}
              </span>
            </div>
            <p className="text-[0.64rem] uppercase tracking-[0.2em] text-[var(--color-antique-gold)]">
              {item.position}
            </p>
            <p className="mt-3 font-serif text-base leading-relaxed text-[var(--color-graphite)]">
              {item.meaning}
            </p>
          </li>
        ))}
      </ol>

      <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-[var(--color-muted)]">
        Читать полезнее слева направо: внутренний мотив → способ действия → проявление → вектор усилия → итоговая сборка.
      </p>
    </section>
  );
}
