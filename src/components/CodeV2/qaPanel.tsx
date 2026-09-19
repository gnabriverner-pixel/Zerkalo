// DEV-ONLY QA surfaces for Code V2 (top bar + preset dates).
// Loaded exclusively through a compile-time `import.meta.env.DEV` dynamic
// import in CodeV2Experience.tsx — the production build physically excludes
// this module: no QA copy, no preset dates reach the browser bundle.
//
// The four dates below are the canonical acceptance fixtures shared with
// server/code_v2_acceptance.test.ts (06.05.1986 is the documented golden
// case). They are intentionally identical to that test canon.

import { RotateCcw } from 'lucide-react';

export const QA_PRESET_DOBS = [
  { label: '06.05.1986', note: 'Венера 6 / Сатурн 8' },
  { label: '06.09.1991', note: 'Венера 6 / Сатурн 8 (усиление)' },
  { label: '18.12.1989', note: 'Марс 9 / Юпитер 3' },
  { label: '01.10.1990', note: 'Солнце 1 / Юпитер 3' }
];

export const QA_DOCUMENT_TITLE = 'Цифровой Код V2 · QA Режим | Зеркало Себя';

export function QaTopBar({ onSwitchToV1 }: { onSwitchToV1?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between w-full gap-3 mb-8 pb-4 border-b border-white/5">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-[var(--color-antique-gold)] animate-pulse" />
        <span className="text-[13px] font-mono tracking-widest uppercase text-[var(--color-antique-gold)]">
          Digital Code V2 · QA Режим
        </span>
      </div>

      <div className="flex items-center gap-3">
        {onSwitchToV1 && (
          <button
            type="button"
            onClick={onSwitchToV1}
            className="text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Переключить на V1</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function QaPreviewToggle({
  isPreviewV2,
  onToggle
}: {
  isPreviewV2: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`min-h-[30px] px-2.5 py-1 rounded-full text-[13px] font-mono tracking-wider uppercase transition-all cursor-pointer border ${
        isPreviewV2
          ? 'bg-[var(--color-antique-gold)]/20 border-[var(--color-antique-gold)] text-amber-200 shadow-xs'
          : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
      }`}
      title="Переключить вертикальный срез Digital Code V2"
    >
      V2 PREVIEW {isPreviewV2 ? '●' : '○'}
    </button>
  );
}

export function QaPresetPicker({
  currentDob,
  onSelect
}: {
  currentDob: string;
  onSelect: (dob: string) => void;
}) {
  return (
    <div className="w-full mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
      <div className="text-[13px] font-mono uppercase tracking-wider text-amber-300/80 mb-3 flex items-center justify-between">
        <span>Контрольные даты для проверки (QA Режим):</span>
        <span className="text-[13px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">qa=1</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QA_PRESET_DOBS.map(preset => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelect(preset.label)}
            className={`px-3 py-2 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
              currentDob === preset.label
                ? 'bg-[var(--color-antique-gold)]/15 border-[var(--color-antique-gold)] text-amber-200 shadow-sm'
                : 'bg-white/5 border-white/5 hover:border-white/15 text-stone-300 hover:text-stone-100'
            }`}
          >
            <div className="text-xs font-mono font-medium">{preset.label}</div>
            <div className="text-[13px] text-stone-400 truncate">{preset.note}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
