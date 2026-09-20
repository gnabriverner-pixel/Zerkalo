import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import child_process from 'child_process';
import net from 'node:net';
import path from 'path';
import { consumeDailyBudget, resolveDailyBudgetMax } from './rateLimit';

// Proxy / rate-limit correctness suite (production mode, real server processes).
//
// Verified topology this suite encodes: nginx on the same host proxies to the app on
// loopback (app binds 127.0.0.1, external access DROPped by iptables) and forwards
// X-Forwarded-For with $proxy_add_x_forwarded_for. Express therefore trusts exactly the
// loopback hop, so `req.ip` is the real client — distinct clients must get distinct
// buckets, and a client must never be able to forge its identity through the header.

const repoRoot = path.resolve(__dirname, '..');

// Ephemeral per-spawn ports reserved from the OS. A fixed base let a concurrent run of this same
// suite (or a stale server) answer on our port: the other instance's boot failed silently while its
// requests were served by the first process, which surfaced as false 429s or a false green.
function reserveFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error('no_free_port'))));
    });
  });
}

interface Harness {
  proc: child_process.ChildProcess;
  baseUrl: string;
  stderr: () => string;
}

async function spawnProductionServer(extraEnv: Record<string, string>): Promise<Harness> {
  const port = await reserveFreePort();
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
        // Pin the provider to "not ready" so the suite can never make a real LLM call
        // (dotenv does not override variables that are already set).
        ROUTERAI_API_KEY: '',
        DEEPSEEK_API_KEY: '',
        DCS_ROOT: process.env.DCS_ROOT || path.resolve(repoRoot, '..', 'digital-code-system'),
        CONTINUATION_CLAIM_SECRET: 'test-secret-at-least-16-chars-long!',
        DELETION_LOOKUP_SECRET: 'test-deletion-secret-at-least-16-chars!',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const stderrChunks: string[] = [];
  proc.stderr?.on('data', chunk => {
    if (stderrChunks.length < 40) stderrChunks.push(chunk.toString());
  });
  return { proc, baseUrl: `http://127.0.0.1:${port}`, stderr: () => stderrChunks.join('') };
}

async function waitForHealth(harness: Harness, timeoutMs = 20_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (harness.proc.exitCode !== null) break; // died before serving: report now, not after the timeout
    try {
      const res = await fetch(`${harness.baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const stderrTail = harness.stderr().slice(-800);
  throw new Error(
    `server did not become healthy at ${harness.baseUrl}` +
      (stderrTail ? `\n--- server stderr (tail) ---\n${stderrTail}` : '')
  );
}

async function stopServer(harness: Harness): Promise<void> {
  if (harness.proc.exitCode === null && !harness.proc.killed) {
    harness.proc.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 400));
    if (harness.proc.exitCode === null) harness.proc.kill('SIGKILL');
  }
}

// Bounded retry: a spawn that dies before serving (for example because its reserved port was
// taken between reservation and bind) must not fail the suite with an opaque timeout.
async function startServer(extraEnv: Record<string, string>): Promise<Harness> {
  let lastError: unknown = new Error('server did not start');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const harness = await spawnProductionServer(extraEnv);
    try {
      await waitForHealth(harness);
      return harness;
    } catch (error) {
      lastError = error;
      await stopServer(harness);
    }
  }
  throw lastError;
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
    harness = await startServer({
      MEETING_RATE_MAX: '2',
      ALBERT_RATE_MAX: '1',
      PERSONAL_MYTH_RATE_MAX: '2',
      LLM_RATE_WINDOW_MS: '600000',
    });
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

describe('Daily cost budget semantics (LLM_DAILY_MAX)', () => {
  let harness: Harness;
  let cookie = '';

  beforeAll(async () => {
    harness = await startServer({ LLM_DAILY_MAX: '1', NODE_ENV: 'production' });
    cookie = await acceptConsent(harness);
  }, 30_000);

  afterAll(async () => {
    if (harness) await stopServer(harness);
  });

  it('is never spent by requests that fail validation', async () => {
    // Albert: empty message -> 400 invalid_message, never the budget code.
    for (let i = 0; i < 3; i += 1) {
      const res = await postJson(harness, '/api/albert/dialogue', cookie, {}, '203.0.113.20');
      expect(res.status).toBe(400);
      expect((await res.json()).code).not.toBe('daily_budget_reached');
    }

    // Albert: OVERSIZED message (2001 chars) — the handler must apply the generator's
    // 2000-char contract before the budget is touched. Previously this passed the door
    // check, consumed the ceiling and only then failed inside the generator.
    const oversized = 'я'.repeat(2001);
    for (let i = 0; i < 3; i += 1) {
      const res = await postJson(harness, '/api/albert/dialogue', cookie, { message: oversized }, '203.0.113.26');
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('invalid_message');
    }

    // Albert: exactly at the limit is still a valid request shape (not a rejection path).
    const atLimit = 'я'.repeat(2000);
    const boundary = await postJson(harness, '/api/albert/dialogue', cookie, { message: atLimit }, '203.0.113.27');
    expect(boundary.status).toBe(503);
    expect((await boundary.json()).code).toBe('albert_provider_not_ready');

    // Meeting: payload precondition only -> 200 with status error, never the budget code.
    for (let i = 0; i < 3; i += 1) {
      const res = await postJson(harness, '/api/meeting-of-mirrors', cookie, {}, '203.0.113.21');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('error');
      expect(body.code).not.toBe('daily_budget_reached');
    }

    // Personal Myth: malformed answers -> 400 invalid_*, never the budget code.
    for (let i = 0; i < 3; i += 1) {
      const res = await postJson(harness, '/api/personal-myth', cookie, { answers: {} }, '203.0.113.22');
      expect(res.status).toBe(400);
      expect((await res.json()).code).not.toBe('daily_budget_reached');
    }
  }, 40_000);

  it('is never spent when nothing was generated (provider not ready)', async () => {
    // Valid request shapes, no LLM provider in this environment: the handlers must answer
    // 503 provider_not_ready WITHOUT touching the global ceiling. Under the previous
    // middleware-level placement the second request here already returned
    // daily_budget_reached — this is the regression guard.
    const mythBody = {
      request_id: 'budget-semantics-test-0001',
      answers: {
        q1: 'первый развёрнутый ответ',
        q2: 'второй развёрнутый ответ',
        q3: 'третий развёрнутый ответ',
        q4: 'четвёртый развёрнутый ответ',
      },
    };
    for (let i = 0; i < 2; i += 1) {
      const res = await postJson(harness, '/api/personal-myth', cookie, mythBody, '203.0.113.23');
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('personal_myth_provider_not_ready');
    }

    const meetingBody = { codeData: { calc: {} }, storyData: { storyInputs: {}, storyResult: {} } };
    for (let i = 0; i < 2; i += 1) {
      const res = await postJson(harness, '/api/meeting-of-mirrors', cookie, meetingBody, '203.0.113.24');
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('meeting_provider_not_ready');
    }

    const albertBody = { message: 'Расскажите подробнее о моей карте' };
    for (let i = 0; i < 2; i += 1) {
      const res = await postJson(harness, '/api/albert/dialogue', cookie, albertBody, '203.0.113.25');
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('albert_provider_not_ready');
    }
  }, 40_000);

  it('enforces the ceiling and resets on the next UTC day (in-process semantics)', () => {
    const original = process.env.LLM_DAILY_MAX;
    try {
      delete process.env.LLM_DAILY_MAX;
      expect(resolveDailyBudgetMax()).toBe(0);
      for (let i = 0; i < 5; i += 1) expect(consumeDailyBudget().allowed).toBe(true);

      process.env.LLM_DAILY_MAX = '2';
      const dayOne = Date.parse('2030-01-01T10:00:00Z');
      expect(consumeDailyBudget(dayOne).allowed).toBe(true);
      expect(consumeDailyBudget(dayOne).allowed).toBe(true);
      const third = consumeDailyBudget(dayOne);
      expect(third.allowed).toBe(false);
      expect(third.limit).toBe(2);

      const nextDay = Date.parse('2030-01-02T00:05:00Z');
      expect(consumeDailyBudget(nextDay).allowed).toBe(true);
    } finally {
      if (original === undefined) delete process.env.LLM_DAILY_MAX;
      else process.env.LLM_DAILY_MAX = original;
    }
  });
});
