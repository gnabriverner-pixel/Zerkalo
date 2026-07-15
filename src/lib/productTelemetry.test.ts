import { describe, expect, it } from 'vitest';
import { isFirstMirrorGenerateRequest } from '../components/FirstMirrorTelemetryBoundary';
import { sanitizeProductEventPayload } from './productAnalytics';

describe('product analytics privacy boundary', () => {
  it('drops sensitive and unknown keys before emission', () => {
    const payload = sanitizeProductEventPayload('first_mirror_generation_succeeded', {
      duration_ms: 420,
      http_status: 200,
      api_status: 'ok',
      date_of_birth: '06.05.1986',
      free_text: 'private answer',
      telegram_handle: '@private',
    });

    expect(payload).toEqual({
      duration_ms: 420,
      http_status: 200,
      api_status: 'ok',
    });
  });

  it('accepts only bounded event-specific values', () => {
    expect(sanitizeProductEventPayload('personal_myth_step_completed', {
      step: 3,
      answer_mode: 'free_text',
    })).toEqual({ step: 3, answer_mode: 'free_text' });

    expect(sanitizeProductEventPayload('personal_myth_step_completed', {
      step: 9,
      answer_mode: 'raw_answer',
      answer: 'must never leave the browser',
    })).toEqual({});
  });

  it('keeps activation content-free and bounds continuation sources', () => {
    expect(sanitizeProductEventPayload('first_mirror_result_viewed', {
      date_of_birth: '06.05.1986',
      generated_text: 'private result',
    })).toEqual({});

    expect(sanitizeProductEventPayload('telegram_deep_cta_click', {
      source: 'first_mirror',
      telegram_handle: '@private',
    })).toEqual({ source: 'first_mirror' });

    expect(sanitizeProductEventPayload('telegram_deep_cta_click', {
      source: 'unknown_surface',
    })).toEqual({});
  });
});

describe('First Mirror telemetry request scope', () => {
  it('matches only the exact POST /api/generate code request', () => {
    expect(isFirstMirrorGenerateRequest('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ mode: 'code', date: 'private-value-is-not-read-by-telemetry' }),
    })).toBe(true);
  });

  it('does not classify unrelated or malformed requests', () => {
    expect(isFirstMirrorGenerateRequest('/api/generate-preview', {
      method: 'POST',
      body: JSON.stringify({ mode: 'code' }),
    })).toBe(false);

    expect(isFirstMirrorGenerateRequest('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ mode: 'story' }),
    })).toBe(false);

    expect(isFirstMirrorGenerateRequest('/api/generate', {
      method: 'GET',
    })).toBe(false);

    expect(isFirstMirrorGenerateRequest('/api/generate', {
      method: 'POST',
      body: '{not-json',
    })).toBe(false);
  });
});
