import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import child_process from 'child_process';
import path from 'path';

// Proxy / rate-limit correctness suite (production mode, real server processes).
//
// Verified topology this suite encodes: nginx on the same host proxies to the app on
// loopback (app binds 127.0.0.1, external access DROPped by iptables) and forwards
// X-Forwarded-For with $proxy_add_x_forwarded_for. Express therefore trusts exactly the
// loopback hop, so `req.ip` is the real client — distinct clients must get distinct
// buckets, and a client must never be able to forge its identity through the header.

const repoRoot = path.resolve(__dirname, '..');

interface Harness {
  proc: child_process.ChildProcess;
  baseUrl: string;
}

function spawnProductionServer(extraEnv: Record<string, string>): Harness {
  const port = 39900 + Math.floor(Math.random() * 90);
  const tsxPath = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const proc = child_process.spawn(
    process.execPath,
    [tsxPath, 'server.ts'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        NODE_ENV: 'production',
        DCS_ROOT: process.env.DCS_ROOT || path.resolve(repoRoot, '..', 'digital-code-system'),
        CONTINUATION_CLAIM_SECRET: 'test-secret-at-least-16-chars-long!',
        DELETION_LOOKUP_SECRET: 'test-deletion-secret-at-least-16-chars!',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return { proc, baseUrl: `http://127.0.0.1:${port}` };
}

async function waitForHealth(harness: Harness, timeoutMs = 20_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${harness.baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`server did not become healthy at ${harness.baseUrl}`);
}

async function stopServer(harness: Harness): Promise<void> {
  if (!harness.proc.killed) {
    harness.proc.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 400));
    if (!harness.proc.killed) harness.proc.kill('SIGKILL');
  }
}

async function acceptConsent(harness: Harness): Promise<string> {
  const current = await fetch(`${harness.baseUrl}/api/consent`).then(r => r.json());
  const res = await fetch(`${harness.baseUrl}/api/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: harness.baseUrl },
    body: JSON.stringify({
      accepted: true,
      adult: true,
      version: current.version,
      scope: 'core',
    }),
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0] || '';
  expect(cookie).toContain('=');
  return cookie;
}

function postJson(harness: Harness, route: string, cookie: string, body: unknown, clientIp?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: cookie,
  };
  if (clientIp) headers['X-Forwarded-For'] = clientIp;
  return fetch(`${harness.baseUrl}${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('Proxy / rate-limit correctness (production mode)', () => {
  let harness: Harness;
  let cookie = '';

  beforeAll(async () => {
    harness = spawnProductionServer({
      MEETING_RATE_MAX: '2',
      ALBERT_RATE_MAX: '1',
      PERSONAL_MYTH_RATE_MAX: '2',
      LLM_RATE_WINDOW_MS: '600000',
    });
    await waitForHealth(harness);
    cookie = await acceptConsent(harness);
  }, 30_000);

  afterAll(async () => {
    if (harness) await stopServer(harness);
  });

  it('Personal Myth is limited PER CLIENT, not for the whole instance', async () => {
    const clientA = '198.51.100.1';
    const first = await postJson(harness, '/api/personal-myth', cookie, {}, clientA);
    const second = await postJson(harness, '/api/personal-myth', cookie, {}, clientA);
    const third = await postJson(harness, '/api/personal-myth', cookie, {}, clientA);

    expect(first.status).not.toBe(429);
    expect(second.status).not.toBe(429);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBeTruthy();
    const thirdBody = await third.json();
    expect(thirdBody.code).toBe('rate_limit_exceeded');

    // A different real client still has its own budget: the old code keyed every
    // request as 127.0.0.1 behind nginx, so this request would have been 429 as well.
    const otherClient = await postJson(harness, '/api/personal-myth', cookie, {}, '198.51.100.2');
    expect(otherClient.status).not.toBe(429);
  }, 30_000);

  it('Meeting guard resolves the real client from X-Forwarded-For behind the trusted loopback hop', async () => {
    const clientA = '203.0.113.10';
    const first = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, clientA);
    const second = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, clientA);
    const third = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, clientA);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);

    const clientB = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, '203.0.113.11');
    expect(clientB.status).toBe(200);
  }, 30_000);

  it('Meeting and Albert have independent budgets', async () => {
    const client = '203.0.113.12';
    const meeting = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, client);
    expect(meeting.status).toBe(200);

    const albertFirst = await postJson(harness, '/api/albert/dialogue', cookie, {}, client);
    expect(albertFirst.status).not.toBe(429);

    const albertSecond = await postJson(harness, '/api/albert/dialogue', cookie, {}, client);
    expect(albertSecond.status).toBe(429);
    expect((await albertSecond.json()).code).toBe('rate_limit_exceeded');

    // Exhausting Albert must not consume the Meeting budget of the same client.
    const meetingAgain = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, client);
    expect(meetingAgain.status).toBe(200);
  }, 30_000);

  it('canonical routes keep working for traffic inside the limits', async () => {
    const meeting = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, '203.0.113.13');
    expect(meeting.status).toBe(200);
    expect((await meeting.json()).status).toBe('error'); // payload precondition, not a guard

    const calculate = await postJson(harness, '/api/calculate', cookie, { dob: '01.01.2000' }, '203.0.113.14');
    expect(calculate.status).toBe(200);
    expect((await calculate.json()).status).toBe('ok');
  }, 30_000);

  it('without the proxy hop a direct caller shares one loopback bucket (fail-closed)', async () => {
    const first = await postJson(harness, '/api/meeting-of-mirrors', cookie, {});
    const second = await postJson(harness, '/api/meeting-of-mirrors', cookie, {});
    const third = await postJson(harness, '/api/meeting-of-mirrors', cookie, {});

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  }, 30_000);
});

describe('Optional daily budget circuit-breaker (LLM_DAILY_MAX)', () => {
  let harness: Harness;
  let cookie = '';

  beforeAll(async () => {
    harness = spawnProductionServer({ LLM_DAILY_MAX: '1', NODE_ENV: 'production' });
    await waitForHealth(harness);
    cookie = await acceptConsent(harness);
  }, 30_000);

  afterAll(async () => {
    if (harness) await stopServer(harness);
  });

  it('is disabled unless the operator sets LLM_DAILY_MAX, and then fails closed', async () => {
    const first = await postJson(harness, '/api/albert/dialogue', cookie, {}, '203.0.113.20');
    expect(first.status).not.toBe(429);

    const second = await postJson(harness, '/api/albert/dialogue', cookie, {}, '203.0.113.21');
    expect(second.status).toBe(429);
    expect((await second.json()).code).toBe('daily_budget_reached');
  }, 30_000);
});
