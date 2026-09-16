import { describe, expect, it, beforeEach } from 'vitest';
import { calculateCanonicalCodeV2 } from '../../server/dcsBridge';
import { firstMirrorFromV2, hasCanonicalV2Result } from './codeV2Session';
import { saveTransientDraft, loadTransientDraft } from './myMirrorStorage';
import { loadTruthState, saveTruthState, persistTruthState, clearTruthState } from './albertTruthState';
import { buildCanonicalEnvelopeFromWebContext } from '../../server/albert';

describe('V2 continuity and source boundaries', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('carries the exact accepted interpretation and canonical matrices through restoration', async () => {
    const payload = await calculateCanonicalCodeV2('18.12.1989');
    expect(hasCanonicalV2Result(payload)).toBe(true);
    const firstMirror = firstMirrorFromV2(payload);
    expect(firstMirror.interpretationVersion).toBe('v2');
    expect(firstMirror.keyInsight).toBe(payload.central_motif);
    const draft = { mode: 'meeting' as const, codeDate: '18.12.1989', codeResult: payload.calculation.canonical_result, codeV2Payload: payload, firstMirror, journeyId: 'same-journey', meetingUserNote: 'Мои слова важнее карты.' };
    saveTransientDraft(draft);
    expect(loadTransientDraft()).toMatchObject(draft);
    const changed = structuredClone(payload);
    changed.calculation.canonical_result.soul = 1;
    expect(hasCanonicalV2Result(changed)).toBe(false);
  });
  it('does not manufacture a completed Myth or Meeting from Code', async () => {
    const payload = await calculateCanonicalCodeV2('18.12.1989');
    const context = { codeV2Payload: payload, userNote: 'Не хочу руководить.' } as any;
    const envelope = buildCanonicalEnvelopeFromWebContext(context, []);
    expect(envelope.experience_state.myth_summary).toBeNull();
    expect(envelope.experience_state.meeting_summary).toBeNull();
    expect(envelope.evidence).toContainEqual(expect.objectContaining({ source: 'code_interpretation', status: 'unreviewed', claim_summary: payload.central_motif }));
    const actual = buildCanonicalEnvelopeFromWebContext({ ...context, mythAnchors: { title: 'Сад', mainImage: 'Тихий сад' }, meetingSummary: 'Различие двух взглядов', centralQuestion: 'Что вам ближе?' }, []);
    expect(actual.experience_state.myth_summary).toBe('Тихий сад');
    expect(actual.experience_state.meeting_summary).toBe('Различие двух взглядов');
    expect(actual.active_thread.current_question).toBe('Что вам ближе?');
  });
  it('preserves corrections within a journey, persists only on save and isolates new people', () => {
    const state = { expiresAt: new Date(Date.now() + 60000).toISOString(), evidence: [{ receipt: 'opaque-server-receipt', source: 'user_correction', reaction_quote: 'Это не про меня' }] };
    saveTruthState('one', state);
    expect(loadTruthState('one')).toEqual(state);
    expect(loadTruthState('two')).toBeUndefined();
    expect(localStorage.getItem('zerkalo.albert.truth.v1')).toBeNull();
    persistTruthState('one');
    sessionStorage.clear();
    expect(loadTruthState('one')).toEqual(state);
    clearTruthState();
    expect(loadTruthState('one')).toBeUndefined();
  });
});
