// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import { CommerceStore, CommerceError } from './commerceStore';
import { installConsentRoutes } from './consent';
import { installStoryCommerce } from './storyCommerce';
import { MockStoryPayment, type StoryPayment } from './storyPayment';
import { STORY_SAMPLE_ANSWERS, STORY_SAMPLE_MYTH } from './storySample';
import { CONSENT_VERSION } from '../src/services/consent';

const KEY = '9'.repeat(64);

afterEach(() => vi.unstubAllEnvs());

async function setupApp(opts: {
  myth?: any;
  albert?: any;
  store?: CommerceStore;
  payment?: StoryPayment;
} = {}) {
  const store = opts.store ?? new CommerceStore(':memory:', KEY);
  const app = express();
  app.use(express.json());
  installConsentRoutes(app);

  const myth = opts.myth ?? vi.fn(async () => ({ status: 'ok', story_result: STORY_SAMPLE_MYTH }));
  const albert = opts.albert ?? vi.fn(async () => ({ status: 'ok', response: 'Синтетический ответ Альберта.' }));
  const payment = opts.payment ?? new MockStoryPayment();

  installStoryCommerce(app, {
    store,
    payment,
    myth,
    albert,
    ready: () => true,
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookies = '';

  const call = async (url: string, body?: any) => {
    const response = await fetch(origin + url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        Cookie: cookies,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0];
      const name = pair.split('=')[0];
      cookies = cookies
        .split('; ')
        .filter((v) => !v.startsWith(name + '='))
        .concat(pair)
        .join('; ');
    }
    const data = await response.json();
    return { response, status: response.status, data, cookies };
  };

  const consent = () => call('/api/consent', { accepted: true, adult: true, version: CONSENT_VERSION, scope: 'core' });
  const close = () => {
    server.close();
    server.closeAllConnections();
    store.close();
  };

  return { store, myth, albert, call, consent, close, getCookies: () => cookies };
}

describe('Release 9: Myth async generation contracts', () => {
  it('1. Mock delay: first POST gets 202 and cookie in <2s, repeated POSTs get 202 running, ready gives 200 ok and order ready', async () => {
    let finish: any;
    const mythMock = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const s = await setupApp({ myth: mythMock });
    try {
      await s.consent();
      const requestId = 'rel9_delay_001';
      const body = { request_id: requestId, answers: STORY_SAMPLE_ANSWERS };

      const t0 = Date.now();
      const first = await s.call('/api/personal-myth', body);
      const elapsed = Date.now() - t0;

      expect(elapsed).toBeLessThan(2000);
      expect(first.status).toBe(202);
      expect(first.data.status).toBe('running');
      expect(first.data.order).toBeDefined();
      expect(s.getCookies()).toContain('zerkalo_stories=');

      // Repeated POSTs while running get 202 running
      for (let i = 0; i < 3; i++) {
        const poll = await s.call('/api/personal-myth', body);
        expect(poll.status).toBe(202);
        expect(poll.data.status).toBe('running');
      }
      expect(mythMock).toHaveBeenCalledTimes(1);

      // Now resolve the mock
      finish({ status: 'ok', story_result: STORY_SAMPLE_MYTH });

      // Client poll receives 200 ok with story_result and order ready
      await vi.waitFor(async () => {
        const done = await s.call('/api/personal-myth', body);
        expect(done.status).toBe(200);
        expect(done.data.status).toBe('ok');
        expect(done.data.story_result.title).toBe(STORY_SAMPLE_MYTH.title);
        expect(done.data.replayed).toBe(true);
      });

      const orderRow = s.store.db.prepare('SELECT state FROM orders WHERE request_key=?').get(requestId) as any;
      expect(orderRow.state).toBe('ready');
    } finally {
      s.close();
    }
  });

  it('2. Mock throws provider_call_timeout -> operation uncertain, repeated POST gets 202 uncertain', async () => {
    const mythMock = vi.fn(async () => {
      throw new Error('provider_call_timeout');
    });
    const s = await setupApp({ myth: mythMock });
    try {
      await s.consent();
      const requestId = 'rel9_timeout_001';
      const body = { request_id: requestId, answers: STORY_SAMPLE_ANSWERS };

      const first = await s.call('/api/personal-myth', body);
      expect(first.status).toBe(202);
      expect(first.data.status).toBe('running');

      await vi.waitFor(async () => {
        const poll = await s.call('/api/personal-myth', body);
        expect(poll.status).toBe(202);
        expect(poll.data.status).toBe('uncertain');
      });

      const op = s.store.db.prepare('SELECT state FROM operations WHERE request_key=?').get(requestId) as any;
      expect(op.state).toBe('uncertain');
    } finally {
      s.close();
    }
  });

  it('3. Mock throws general error -> failed, generation_failed, new attempt allowed', async () => {
    const mythMock = vi.fn(async () => {
      throw new Error('generic_model_crash');
    });
    const s = await setupApp({ myth: mythMock });
    try {
      await s.consent();
      const requestId = 'rel9_error_001';
      const body = { request_id: requestId, answers: STORY_SAMPLE_ANSWERS };

      const first = await s.call('/api/personal-myth', body);
      expect(first.status).toBe(202);
      expect(first.data.status).toBe('running');

      await vi.waitFor(async () => {
        const poll = await s.call('/api/personal-myth', body);
        expect(poll.status).toBe(202);
        expect(poll.data.status).toBe('failed');
        expect(poll.data.order.state).toBe('generation_failed');
      });

      const order = s.store.db.prepare('SELECT state FROM orders WHERE request_key=?').get(requestId) as any;
      expect(order.state).toBe('generation_failed');

      // Now mock succeeds on retry with a fresh request_id
      s.myth.mockImplementation(async () => ({ status: 'ok', story_result: STORY_SAMPLE_MYTH }));
      const retryBody = { request_id: 'rel9_error_retry_001', answers: STORY_SAMPLE_ANSWERS };
      const retryFirst = await s.call('/api/personal-myth', retryBody);
      expect(retryFirst.status).toBe(202);

      await vi.waitFor(async () => {
        const retryDone = await s.call('/api/personal-myth', retryBody);
        expect(retryDone.status).toBe(200);
        expect(retryDone.data.status).toBe('ok');
      });
    } finally {
      s.close();
    }
  });

  it('4. Stale uncertain operations (>15 min) do NOT block visitors; young uncertain (<15 min) DO trigger service_busy', async () => {
    const store = new CommerceStore(':memory:', KEY);
    try {
      const a1 = store.createAccount(true);
      const a2 = store.createAccount(true);
      const o1 = store.createOrder(a1.id, 'stale_1', 'free', true);
      const o2 = store.createOrder(a2.id, 'stale_2', 'free', true);
      store.saveAnswers(a1.id, o1.id, STORY_SAMPLE_ANSWERS, '');
      store.saveAnswers(a2.id, o2.id, STORY_SAMPLE_ANSWERS, '');

      // Insert 2 operations older than 15 minutes (e.g. 20 min ago)
      const twentyMinAgo = Date.now() - 20 * 60 * 1000;
      store.db.prepare(
        "INSERT INTO operations(order_id, request_key, kind, input_hash, state, created_at) VALUES (?, 'req_op1', 'myth', 'h1', 'uncertain', ?)"
      ).run(o1.id, twentyMinAgo);
      store.db.prepare(
        "INSERT INTO operations(order_id, request_key, kind, input_hash, state, created_at) VALUES (?, 'req_op2', 'myth', 'h2', 'uncertain', ?)"
      ).run(o2.id, twentyMinAgo);

      vi.stubEnv('FREE_PREVIEW_ENABLED', 'true');

      // A new user attempts reservation
      const a3 = store.createAccount(true);
      const o3 = store.createOrder(a3.id, 'new_req_3', 'free', true);
      store.saveAnswers(a3.id, o3.id, STORY_SAMPLE_ANSWERS, '');
      // reserve should NOT throw service_busy because the 2 uncertain operations are older than 15 min
      const res = store.reserve(a3.id, o3.id, 'new_req_3', 'myth', STORY_SAMPLE_ANSWERS);
      expect(res.state).toBe('reserved');

      // Now update them to be younger than 15 minutes (e.g. 5 min ago)
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      store.db.prepare("UPDATE operations SET created_at=? WHERE request_key IN ('req_op1', 'req_op2')").run(fiveMinAgo);

      const a4 = store.createAccount(true);
      const o4 = store.createOrder(a4.id, 'new_req_4', 'free', true);
      store.saveAnswers(a4.id, o4.id, STORY_SAMPLE_ANSWERS, '');
      // reserve MUST throw service_busy (503) because count of active uncertain >= 2
      expect(() => store.reserve(a4.id, o4.id, 'new_req_4', 'myth', STORY_SAMPLE_ANSWERS)).toThrowError(
        expect.objectContaining({ message: 'service_busy', status: 503 })
      );
    } finally {
      store.close();
    }
  });

  it('5. 72 repeated POSTs over 6 minutes do not trip rate limits and create exactly 1 operation', async () => {
    let finish: any;
    const mythMock = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const s = await setupApp({ myth: mythMock });
    try {
      await s.consent();
      const requestId = 'rel9_poll72_001';
      const body = { request_id: requestId, answers: STORY_SAMPLE_ANSWERS };

      // Initial call
      const init = await s.call('/api/personal-myth', body);
      expect(init.status).toBe(202);
      expect(init.data.status).toBe('running');

      // 72 polls with the same request_id
      for (let i = 0; i < 72; i++) {
        const poll = await s.call('/api/personal-myth', body);
        expect(poll.status).toBe(202);
        expect(poll.data.status).toBe('running');
      }

      // Finish model
      finish({ status: 'ok', story_result: STORY_SAMPLE_MYTH });

      await vi.waitFor(async () => {
        const done = await s.call('/api/personal-myth', body);
        expect(done.status).toBe(200);
        expect(done.data.status).toBe('ok');
      });

      // Verify exactly 1 operation exists for this order
      const ops = s.store.db.prepare('SELECT * FROM operations WHERE request_key=?').all(requestId);
      expect(ops).toHaveLength(1);
    } finally {
      s.close();
    }
  });

  it('6. Albert behavior remains synchronous: returns 200 ok directly', async () => {
    const s = await setupApp();
    try {
      await s.consent();
      // First create and deliver a free myth so order is ready
      const mythRes = await s.call('/api/personal-myth', { request_id: 'rel9_albert_setup', answers: STORY_SAMPLE_ANSWERS });
      expect(mythRes.status).toBe(202);
      await vi.waitFor(async () => {
        const done = await s.call('/api/personal-myth', { request_id: 'rel9_albert_setup', answers: STORY_SAMPLE_ANSWERS });
        expect(done.status).toBe(200);
      });

      const stories = (await s.call('/api/stories')).data;
      const orderId = stories.orders[0].id;

      // Albert call: must return 200 immediately (synchronous), not 202
      const albertRes = await s.call(`/api/stories/${orderId}/albert`, {
        request_key: 'rel9_albert_msg_001',
        message: 'Как мне поступить?',
      });

      expect(albertRes.status).toBe(200);
      expect(albertRes.data.status).toBe('ok');
      expect(albertRes.data.reply).toBe('Синтетический ответ Альберта.');
      expect(s.albert).toHaveBeenCalledTimes(1);
    } finally {
      s.close();
    }
  });
});
