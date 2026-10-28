import { describe, expect, it } from 'vitest';
import express from 'express';
import { AddressInfo } from 'node:net';
import { DISABLED_LEGACY_ENDPOINTS, installLegacyEndpointGate } from './legacyEndpoints';

async function withApp(env: NodeJS.ProcessEnv, run: (post: (path: string) => Promise<number>) => Promise<void>) {
  const app = express();
  installLegacyEndpointGate(app, env);
  for (const path of [...DISABLED_LEGACY_ENDPOINTS, '/api/delete-data', '/api/code-v2']) app.post(path, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    await run(async path => (await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST' })).status);
  } finally { server.close(); }
}

describe('endpoints without a live client', () => {
  it('answer 404 by default, while the live ones are untouched', async () => {
    await withApp({}, async post => {
      for (const path of DISABLED_LEGACY_ENDPOINTS) expect(await post(path), path).toBe(404);
      expect(await post('/api/delete-data')).toBe(200);
      expect(await post('/api/code-v2')).toBe(200);
    });
  });
  it('come back with LEGACY_ENDPOINTS_ENABLED=true', async () => {
    await withApp({ LEGACY_ENDPOINTS_ENABLED: 'true' }, async post => {
      for (const path of DISABLED_LEGACY_ENDPOINTS) expect(await post(path), path).toBe(200);
    });
  });
  it('the list is exactly the five agreed routes', () => {
    expect([...DISABLED_LEGACY_ENDPOINTS].sort()).toEqual(['/api/chapter-sample/pdf', '/api/generate', '/api/handoff/create-claim', '/api/launch-interest', '/api/privacy/register-session']);
  });
});
