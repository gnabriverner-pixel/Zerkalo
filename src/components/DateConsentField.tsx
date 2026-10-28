import React from 'react';

export const DATE_CONSENT_LABEL = 'Согласен на обработку даты по политике';
export const DATE_CONSENT_REQUIRED_MESSAGE = 'Чтобы продолжить, отметьте согласие под датой.';

/** One mark under the date fields: consent to processing the date under the policy, 18+. */
export function DateConsentField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="mt-5 text-sm text-stone-300 space-y-2" data-testid="date-consent">
      <label className="flex items-start gap-3 min-h-11 cursor-pointer leading-relaxed">
        <input
          type="checkbox"
          checked={checked}
          onChange={event => onChange(event.target.checked)}
          className="mt-1 size-5 shrink-0"
        />
        <span>
          {DATE_CONSENT_LABEL} (<a href="/privacy" target="_blank" rel="noreferrer" className="underline text-[var(--color-antique-gold)]">политика</a>). Мне есть 18 лет.
        </span>
      </label>
      <p className="text-xs text-stone-400 pl-8">Дата нужна для расчёта; в нашей базе она не сохраняется.</p>
      <details className="text-xs text-stone-400 pl-8">
        <summary className="cursor-pointer py-1">Подробнее</summary>
        <p className="leading-relaxed pt-1">Ответы для Личного мифа уходят языковой модели, чтобы написать текст. Согласие можно отозвать, а данные удалить в любой момент.</p>
        <p className="leading-relaxed pt-1">
          Сайт информационно-развлекательный и только для тех, кому исполнилось 18 лет. Не вводите чужие данные. Где хранятся данные, кому они передаются и как их удалить —{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline text-[var(--color-antique-gold)]">в политике</a>.
        </p>
      </details>
    </div>
  );
}
