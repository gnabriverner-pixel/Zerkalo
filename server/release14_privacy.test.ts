import { describe, expect, it, vi } from 'vitest';
import { generateAlbertDialogue, type AlbertDialogueRequest } from './albert';
import { generatePersonalMyth, parsePersonalMythRequest, type PersonalMythProvider } from './myth';

// Synthetic date only. It must stay on our server: no model-bound request may contain it in any common format.
const DOB = '01.07.1990';
const DOB_FORMS = [DOB, '1990-07-01', '07.1990', '1990-7-1', '1 июля 1990', '01/07/1990', '19900701'];

function expectNoDob(serialized: string) {
  for (const form of DOB_FORMS) expect(serialized, `date form leaked: ${form}`).not.toContain(form);
}

describe('birth date never reaches a model request (release 14)', () => {
  it('Albert: the bridge request body does not carry the date, even when the client sends it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'ok', text: 'Готовый ответ синтетического теста.', provider: 'test', model: 'test',
      next_open_loop: null, grounding_state: 'grounded',
    }), { status: 200 }));
    try {
      const request: AlbertDialogueRequest = {
        message: 'Расскажи, что в моём коде главное?',
        history: [{ sender: 'user', text: 'Здравствуйте.' }],
        context: {
          codeDate: DOB,
          codeCalculation: { date: DOB, canonical_result: { soul: 7 } } as any,
          codeV2Payload: { calculation: { date: DOB, canonical_result: { soul: 7 } } } as any,
          codeAnchors: { numbers: { soul: 7, path: 1, direction: 8, expression: 9, result: 5 }, keyInsight: 'Глубина и действие.' },
        },
      } as any;
      await generateAlbertDialogue(request, undefined, 'deepseek-v4-pro', 45_000, { version: 'zerkalo-2026-10-v2', recordedAt: 1700000000000 });
      expect(fetchMock).toHaveBeenCalled();
      for (const call of fetchMock.mock.calls) expectNoDob(String(call[1]?.body ?? ''));
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('Personal Myth: the prompt sent to the provider is built from the answers only', async () => {
    const prompts: string[] = [];
    const provider: PersonalMythProvider = {
      name: 'test', model: 'test', isReady: () => true,
      generate: vi.fn(async (prompt: string) => { prompts.push(prompt); throw new Error('stop_after_capture'); }),
    };
    const request = parsePersonalMythRequest({
      request_id: 'request_1234567890',
      answers: { q1: 'тяжесть и развилка', q2: 'дверь в тумане', q3: 'прогулка у воды', q4: 'ясности' },
      codeDate: DOB, dob: DOB,
    } as any);
    await generatePersonalMyth(request, provider, 5_000).catch(() => undefined);
    expect(prompts.length).toBeGreaterThan(0);
    for (const prompt of prompts) expectNoDob(prompt);
    expect(JSON.stringify(request)).not.toContain(DOB);
  });
});
