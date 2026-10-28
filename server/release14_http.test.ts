// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { CommerceStore } from './commerceStore';
import { installConsentRoutes } from './consent';
import { installStoryCommerce } from './storyCommerce';
import { MockStoryPayment } from './storyPayment';
import { STORY_SAMPLE_ANSWERS, STORY_SAMPLE_MYTH } from './storySample';
import { CONSENT_VERSION } from '../src/services/consent';
import { PATH_EVENTS, dailyCounts, readPathCounters, recordPathEvent, prunePathCounters } from './pathCounters';
import { personalMythHealthInfo } from './mythHealth';
import { STORY_PRICE, STORY_PRICE_RUB, STORY_PRICE_VALUE } from '../src/services/storyPrice';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r14-'));
const countersFile = path.join(tmp, 'path_counters.jsonl');
let server: Server;
let origin = '';
const envBackup: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined) => { if (!(k in envBackup)) envBackup[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; };

beforeAll(async () => {
  setEnv('PATH_COUNTERS_FILE', countersFile);
  setEnv('DCS_BRIDGE_URL', 'http://127.0.0.1:9');
  setEnv('PERSONAL_MYTH_WRITER', undefined);
  setEnv('TESTER_FEEDBACK_ENABLED', undefined);
  const { createApp } = await import('../server');
  const application = await createApp({ skipVite: true });
  server = application.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => {
  server?.close(); (server as any)?.closeAllConnections?.();
  for (const [k, v] of Object.entries(envBackup)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const post = (p: string, body: unknown, cookie = '', withOrigin = true) => fetch(origin + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(withOrigin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});
async function consentCookie() {
  const r = await post('/api/consent', { accepted: true, adult: true, version: CONSENT_VERSION, scope: 'core' });
  expect(r.status).toBe(200);
  return r.headers.get('set-cookie')!.split(';')[0];
}

describe('/health/ready shows the Myth writer actually in use', () => {
  it('default writer v2a: Opus model and writer v2a, not the old deepseek / v1.5', async () => {
    const r = await fetch(origin + '/health/ready');
    const body = await r.json();
    const m = body.providers.personal_myth;
    expect(m.model).toBe('anthropic/claude-opus-5.5');
    expect(m.writer).toBe('personal-myth-v2a');
    expect(m.model).not.toContain('deepseek');
    expect(m.writer).not.toBe('personal-myth-v1.5-emergent-possibility');
  });
  it('follows the configured writer', () => {
    expect(personalMythHealthInfo({ PERSONAL_MYTH_WRITER: 'v41' } as any)).toMatchObject({ model: 'anthropic/claude-opus-5.5', writer: 'personal-myth-writer-v4.2' });
    expect(personalMythHealthInfo({ PERSONAL_MYTH_WRITER: 'legacy' } as any, 'deepseek/x')).toMatchObject({ model: 'deepseek/x', writer: 'personal-myth-v1.5-emergent-possibility' });
  });
});

describe('tester feedback is off by default', () => {
  it('returns 404 feedback_disabled even with valid consent and no file is written', async () => {
    const cookie = await consentCookie();
    const r = await post('/api/feedback', { score: 8, recognizeMotifs: 'x' }, cookie);
    expect(r.status).toBe(404);
    expect((await r.json()).code).toBe('feedback_disabled');
  });
});

describe('anonymous path counters', () => {
  it('accepts only browser-side events and stores name, time and test flag only', async () => {
    expect((await post('/api/path-event', { name: 'date_entered' })).status).toBe(204);
    expect((await post('/api/path-event', { name: 'code_result_shown', dob: '01.07.1990', ip: '1.2.3.4', account: 'a' })).status).toBe(204);
    expect((await post('/api/path-event', { name: 'bridge_clicked' })).status).toBe(204);
    expect((await post('/api/path-event', { name: 'paid' })).status).toBe(400);
    expect((await post('/api/path-event', { name: 'anything' })).status).toBe(400);
    const raw = fs.readFileSync(countersFile, 'utf8');
    expect(raw).not.toContain('1990');
    expect(raw).not.toContain('1.2.3.4');
    for (const line of raw.trim().split('\n')) expect(Object.keys(JSON.parse(line)).sort()).toEqual(['e', 't', 'test']);
    expect(readPathCounters(countersFile).map(r => r.e)).toEqual(['date_entered', 'code_result_shown', 'bridge_clicked']);
  });
  it('report groups by day and drops test rows unless asked', () => {
    const f = path.join(tmp, 'r.jsonl');
    const day = Date.UTC(2026, 9, 28, 12, 0, 0);
    for (const [e, test] of [['date_entered', false], ['date_entered', false], ['paid', false], ['paid', true]] as const) recordPathEvent(e, test, day);
    // recordPathEvent writes to PATH_COUNTERS_FILE; read all rows of the day
    const rows = readPathCounters(countersFile).filter(r => r.t === day);
    const real = dailyCounts(rows);
    expect(real).toHaveLength(1);
    expect(real[0][0]).toBe('2026-10-28');
    expect(real[0][1].date_entered).toBe(2);
    expect(real[0][1].paid).toBe(1);
    expect(dailyCounts(rows, true)[0][1].paid).toBe(2);
    expect(PATH_EVENTS).toHaveLength(7);
    void f;
  });
  it('prunes rows older than 90 days', () => {
    const f = path.join(tmp, 'p.jsonl');
    const now = Date.UTC(2026, 9, 28);
    fs.writeFileSync(f, JSON.stringify({ e: 'paid', t: now - 100 * 86400_000, test: 0 }) + '\n' + JSON.stringify({ e: 'paid', t: now - 1000, test: 0 }) + '\n');
    expect(prunePathCounters(now, f)).toBe(1);
    expect(readPathCounters(f)).toHaveLength(1);
  });
});

describe('deletion endpoint called by the interface', () => {
  it('without a token it needs the same origin and a consent receipt', async () => {
    expect((await post('/api/delete-data', {}, '', false)).status).toBe(403);
    const r = await post('/api/delete-data', {});
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe('invalid_token');
  });
});

describe('server-side counters and storage cookie', () => {
  async function commerceApp() {
    const store = new CommerceStore(':memory:', 'c'.repeat(64));
    const app = express(); app.use(express.json()); installConsentRoutes(app);
    installStoryCommerce(app, { store, payment: new MockStoryPayment(), myth: vi.fn(async () => ({ status: 'ok', story_result: STORY_SAMPLE_MYTH })), albert: vi.fn(), ready: () => true });
    const s = app.listen(0, '127.0.0.1'); await once(s, 'listening');
    const o = `http://127.0.0.1:${(s.address() as any).port}`;
    let cookies = '';
    const call = async (url: string, body?: any) => {
      const response = await fetch(o + url, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: o, Cookie: cookies, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const raw = response.headers.getSetCookie();
      for (const value of raw) { const pair = value.split(';')[0], name = pair.split('=')[0]; cookies = cookies.split('; ').filter(v => v && !v.startsWith(name + '=')).concat(pair).join('; '); }
      return { response, raw, data: await response.json() };
    };
    return { call, close: () => { s.close(); (s as any).closeAllConnections(); store.close(); }, store };
  }

  it('zerkalo_stories is a session cookie until storage consent, then 365 days', async () => {
    const before = process.env.COMMERCE_ENABLED; process.env.COMMERCE_ENABLED = 'true';
    const c = await commerceApp();
    try {
      await c.call('/api/consent', { accepted: true, adult: true, version: CONSENT_VERSION, scope: 'core' });
      const first = await c.call('/api/personal-myth', { request_id: 'r14_cookie_001', answers: STORY_SAMPLE_ANSWERS });
      const set = first.raw.find(v => v.startsWith('zerkalo_stories='))!;
      expect(set).toBeDefined();
      expect(set).not.toMatch(/Max-Age|Expires/i);
      const accepted = await c.call('/api/stories/account', { storage_accepted: true, storage_version: 'personal-history-storage-v1' });
      expect(accepted.response.status).toBe(200);
      const upgraded = accepted.raw.find(v => v.startsWith('zerkalo_stories='))!;
      expect(upgraded).toMatch(/Max-Age=31536000/);
    } finally { c.close(); if (before === undefined) delete process.env.COMMERCE_ENABLED; else process.env.COMMERCE_ENABLED = before; }
  });

  it('commerce events feed the path counters (myth_started, myth_ready) with the test flag', async () => {
    const f = path.join(tmp, 'commerce.jsonl'); setEnv('PATH_COUNTERS_FILE', f);
    const before = process.env.COMMERCE_ENABLED; process.env.COMMERCE_ENABLED = 'true';
    const c = await commerceApp();
    try {
      await c.call('/api/consent', { accepted: true, adult: true, version: CONSENT_VERSION, scope: 'core' });
      await c.call('/api/personal-myth', { request_id: 'r14_counter_001', answers: STORY_SAMPLE_ANSWERS });
      await new Promise(r => setTimeout(r, 100));
      const rows = readPathCounters(f);
      const names = rows.map(r => r.e);
      expect(names).toContain('myth_started');
      expect(names).toContain('myth_ready');
      expect(rows.every(r => r.test === 1)).toBe(true);
      expect(Object.keys(rows[0]).sort()).toEqual(['e', 't', 'test']);
    } finally { c.close(); setEnv('PATH_COUNTERS_FILE', countersFile); if (before === undefined) delete process.env.COMMERCE_ENABLED; else process.env.COMMERCE_ENABLED = before; }
  });
});

describe('price lives in one place', () => {
  it('derives every representation from STORY_PRICE', () => {
    expect(STORY_PRICE).toBe(79000);
    expect(STORY_PRICE_RUB * 100).toBe(STORY_PRICE);
    expect(STORY_PRICE_VALUE).toBe((STORY_PRICE / 100).toFixed(2));
  });
  it('no hard-coded price strings remain in server/ or src/ (outside tests and the price module)', () => {
    const roots = [path.resolve(__dirname), path.resolve(__dirname, '../src')];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name) || /\.test\./.test(e.name) || e.name === 'storyPrice.ts') continue;
        if (/790(\.00)?\b/.test(fs.readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    roots.forEach(walk);
    expect(hits).toEqual([]);
  });
});
