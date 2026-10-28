import { describe, expect, it, vi } from 'vitest';
import { buildCanonicalEnvelopeFromWebContext, generateAlbertDialogue, type AlbertDialogueRequest } from './albert';

const DOB = '01.07.1990';
const myth = {
  title: 'Вторая лампа',
  story: 'На краю деревни стоит дом с одним большим окном.\n\nМастер зажигает вторую лампу.',
  mirror: {},
  made_of: [
    { element: 'Дом, где всё пополам', source: 'В паре я часто соглашаюсь на общие планы' },
    { element: 'Вторая лампа с синим стеклом', source: 'Близости, в которой остаётся своё место' },
  ],
  meaning: ['Возможно, ваше «да» звучит раньше, чем вы успеваете спросить себя.'],
  journal_question: 'О каком своём вечере вы могли бы сказать вслух?',
  one_step: 'Семь дней. Назовите одну «шкатулку» и устройте ей место дома.',
  disclaimer: '',
};
const context: any = {
  storyInputs: { q1: 'Соглашаюсь на общие планы.', q2: '', q3: 'Спокойно выбрали разное.', q4: 'Близости со своим местом.' },
  storyResult: myth,
  mythAnchors: { title: myth.title, oneStep: myth.one_step },
};
const claims = (envelope: any) => Object.fromEntries(envelope.evidence.map((e: any) => [e.source_ref, e.claim_summary]));

describe('Albert receives the whole mode-A Myth', () => {
  it('has made_of table, meaning, question, practice and the tale in the evidence', () => {
    const c = claims(buildCanonicalEnvelopeFromWebContext(context, []));
    expect(c['myth.madeOf']).toContain('Дом, где всё пополам ← В паре я часто соглашаюсь на общие планы');
    expect(c['myth.madeOf']).toContain('Вторая лампа с синим стеклом');
    expect(c['myth.meaning']).toContain('ваше «да» звучит раньше');
    expect(c['myth.question']).toContain('О каком своём вечере');
    expect(c['myth.oneStep']).toContain('Семь дней');
    expect(c['myth.story']).toContain('Мастер зажигает вторую лампу');
    expect(c['myth.title']).toContain('Вторая лампа');
  });
  it('limits the length of the tale and of every table cell', () => {
    const long = 'я'.repeat(9000);
    const c = claims(buildCanonicalEnvelopeFromWebContext({ ...context, storyResult: { ...myth, story: long, made_of: [{ element: long, source: long }] } }, []));
    expect(c['myth.story'].length).toBeLessThan(3600);
    expect(c['myth.madeOf'].length).toBeLessThan(500);
  });
  it('older Myths with mirror blocks are unchanged: no mode-A claims', () => {
    const old = { ...myth, made_of: undefined, meaning: [], journal_question: '', story: '', mirror: { mainImage: 'Образ', innerTension: 'Напряжение', hiddenResource: 'Опора', newView: 'Взгляд' } };
    const c = claims(buildCanonicalEnvelopeFromWebContext({ ...context, storyResult: old, mythAnchors: { title: 'Старый', mainImage: 'Образ', oneStep: 'Шаг' } }, []));
    expect(c['myth.madeOf']).toBeUndefined();
    expect(c['myth.story']).toBeUndefined();
    expect(c['myth.mainImage']).toBe('Образ');
  });
  it('the birth date still does not reach the model request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'ok', text: 'Готовый ответ синтетического теста.', provider: 'test', model: 'test', next_open_loop: null, grounding_state: 'grounded',
    }), { status: 200 }));
    try {
      const request = { message: 'Что в моём Мифе главное?', history: [], context: { ...context, codeDate: DOB, codeCalculation: { date: DOB, canonical_result: { soul: 7 } } } } as AlbertDialogueRequest;
      await generateAlbertDialogue(request, undefined, 'deepseek-v4-pro', 45_000, { version: 'zerkalo-2026-10-v2', recordedAt: 1700000000000 });
      const bodies = fetchMock.mock.calls.map(c => String(c[1]?.body ?? ''));
      expect(bodies.some(b => b.includes('myth.madeOf'))).toBe(true);
      for (const b of bodies) for (const form of [DOB, '1990-07-01', '19900701']) expect(b).not.toContain(form);
    } finally { fetchMock.mockRestore(); }
  });
});
