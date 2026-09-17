import type { CodeV2Payload, FirstMirror } from '../types';

/** Adapt the accepted reading, never regenerate an older interpretation. */
export function firstMirrorFromV2(payload: CodeV2Payload): FirstMirror {
  const lead = payload.interactions[0];
  return {
    interpretationVersion: "v2",
    title: lead?.heading || 'Ваш Цифровой Код',
    subtitle: 'Символическая карта для проверки на собственном опыте',
    formula: {
      numbers: payload.positions.map(p => p.energy).join(' · '),
      planets: payload.positions.map(p => p.energy_name).join(' · '),
      positions: payload.positions.map(p => p.public_name).join(' · '),
    },
    keyInsight: payload.central_motif || payload.synthesis.strongest_motif,
    blocks: [
      { id: 'main_pattern', title: 'Главная гипотеза', text: payload.central_motif || payload.synthesis.strongest_motif },
      { id: 'strength', title: 'Возможная опора', text: payload.positions.map(p => `${p.public_name}: ${p.strong_form}`).join('\n') },
      { id: 'tension', title: 'Что стоит проверить', text: payload.interactions.map(i => i.meaning).join('\n') },
    ],
    strengthTags: [],
    tensionTags: [],
    practicalStep: payload.albert_context.opening_question,
    cta: { title: 'Другой взгляд', text: 'Исследуйте свои образы в Личном мифе.', button: 'Перейти к Личному мифу' },
    disclaimer: payload.method_orientation.epistemic_frame,
  };
}

export function hasCanonicalV2Result(payload: CodeV2Payload): boolean {
  const result = payload?.calculation?.canonical_result;
  const numbers = payload?.calculation?.five_numbers;
  return !!result && !!numbers && ['soul', 'expression', 'path', 'direction', 'result'].every(key => {
    const value = result[key as keyof typeof result];
    return typeof value === 'number' && Number.isFinite(value) && value === numbers[key as keyof typeof numbers];
  }) && !!result.baseMatrix && !!result.detailedMatrix;
}
