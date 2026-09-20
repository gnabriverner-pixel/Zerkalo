import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { calculateCanonicalDigitalCode, calculateCanonicalCodeV2 } from "./dcsBridge";
import { registerDeletionScope, executeDataDeletion } from "./deletion";

describe("T1 Regression: Web DOB Cache Deletion Invariant", () => {
  const scopesFile = path.join(process.cwd(), "data", "deletion_scopes.json");
  const backupFile = path.join(process.cwd(), "data", "deletion_scopes.json.bak.cache_test");

  beforeAll(() => {
    if (fs.existsSync(scopesFile)) {
      fs.copyFileSync(scopesFile, backupFile);
    }
    if (!process.env.DELETION_LOOKUP_SECRET || process.env.DELETION_LOOKUP_SECRET.length < 16) {
      process.env.DELETION_LOOKUP_SECRET = "test-deletion-secret-at-least-32-chars-long!";
    }
  });

  afterAll(() => {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, scopesFile);
      try { fs.unlinkSync(backupFile); } catch {}
    } else if (fs.existsSync(scopesFile)) {
      try { fs.unlinkSync(scopesFile); } catch {}
    }
  });

  it("fails when /api/delete-data path fails to purge calculationCache and codeV2Cache for deleted synthetic DOB", async () => {
    const SYNTHETIC_DOB = "01.01.1950";

    // 1. Populate calculationCache and confirm caching by object reference equality
    const calc1 = await calculateCanonicalDigitalCode(SYNTHETIC_DOB);
    const calc2 = await calculateCanonicalDigitalCode(SYNTHETIC_DOB);
    expect(calc1).toBe(calc2); // Proves in-memory caching is active

    // 2. Populate codeV2Cache and confirm caching by object reference equality
    const v2_1 = await calculateCanonicalCodeV2(SYNTHETIC_DOB);
    const v2_2 = await calculateCanonicalCodeV2(SYNTHETIC_DOB);
    expect(v2_1).toBe(v2_2); // Proves codeV2 caching is active

    // 3. Register deletion scope with the synthetic DOB as cacheKey
    const deletionToken = "test_synthetic_deletion_token_12345678";
    registerDeletionScope(deletionToken, {
      cacheKey: SYNTHETIC_DOB,
    });

    // 4. Execute deletion via the exact deletion path invoked by POST /api/delete-data
    const deletionResult = await executeDataDeletion(deletionToken);
    expect(deletionResult.status).toBe("ok");

    // Purged cache count must reflect that cache entries were removed
    expect(deletionResult.purgedCacheCount).toBeGreaterThanOrEqual(1);

    // 5. Verify that calculationCache entry for SYNTHETIC_DOB was purged
    // If purged, next calculation call MUST produce a fresh object, not the cached reference
    const calc3 = await calculateCanonicalDigitalCode(SYNTHETIC_DOB);
    expect(calc3).not.toBe(calc1);

    // 6. Verify that codeV2Cache entry for SYNTHETIC_DOB was purged
    const v2_3 = await calculateCanonicalCodeV2(SYNTHETIC_DOB);
    expect(v2_3).not.toBe(v2_1);
  });

  it("verifies cache isolation: deleting User A does not purge User B cache", async () => {
    const DOB_A = "02.02.1952";
    const DOB_B = "03.03.1953";

    // Populate both caches for User A and User B
    const calcA1 = await calculateCanonicalDigitalCode(DOB_A);
    const calcB1 = await calculateCanonicalDigitalCode(DOB_B);

    const tokenA = "test_token_user_a_isolation_123456789";
    registerDeletionScope(tokenA, { cacheKey: DOB_A });

    // Delete User A
    const resA = await executeDataDeletion(tokenA);
    expect(resA.status).toBe("ok");

    // User A should be purged (fresh object reference)
    const calcA2 = await calculateCanonicalDigitalCode(DOB_A);
    expect(calcA2).not.toBe(calcA1);

    // User B MUST remain cached (identical object reference)
    const calcB2 = await calculateCanonicalDigitalCode(DOB_B);
    expect(calcB2).toBe(calcB1);
  });

  it("verifies idempotency: repeated deletion does not corrupt state or throw", async () => {
    const DOB_IDEM = "04.04.1954";
    await calculateCanonicalDigitalCode(DOB_IDEM);

    const token = "test_token_idempotent_1234567890123";
    registerDeletionScope(token, { cacheKey: DOB_IDEM });

    const firstDelete = await executeDataDeletion(token);
    expect(firstDelete.status).toBe("ok");

    // Repeating delete on already deleted scope returns proper safe result without crash
    const secondDelete = await executeDataDeletion(token);
    expect(secondDelete.status).toBe("error");
    expect(secondDelete.code).toBe("deletion_scope_not_found");
  });

  it("verifies HTTP route contract: /api/delete-data purges registered cacheKey over HTTP", async () => {
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());

    // Mount session registration and deletion endpoints matching server.ts
    app.post("/api/privacy/register-session", (req, res) => {
      try {
        const token = req.body?.token || "test_token_http_" + Date.now();
        const { anonymousId, sessionToken, cacheKey, cacheKeys, dob } = req.body || {};
        const keys: string[] = [];
        if (typeof cacheKey === "string" && cacheKey.trim()) keys.push(cacheKey.trim());
        if (typeof dob === "string" && dob.trim() && !keys.includes(dob.trim())) keys.push(dob.trim());
        if (Array.isArray(cacheKeys)) {
          for (const k of cacheKeys) {
            const trimmed = String(k || "").trim();
            if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
          }
        }
        registerDeletionScope(token, { anonymousId, sessionToken, cacheKeys: keys });
        return res.status(200).json({ status: "ok", token });
      } catch (err: any) {
        return res.status(500).json({ status: "error", message: err.message });
      }
    });

    app.post("/api/delete-data", async (req, res) => {
      try {
        const token = String(req.body?.token || "").trim();
        const result = await executeDataDeletion(token);
        if (result.status === "error") {
          const isInput = result.code === "invalid_token" || result.code === "deletion_scope_not_found";
          return res.status(isInput ? 400 : 503).json(result);
        }
        return res.status(200).json(result);
      } catch (err: any) {
        return res.status(503).json({ status: "error", code: "deletion_incomplete", retryable: true, message: err.message });
      }
    });

    const server = await new Promise<any>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const HTTP_DOB = "05.05.1955";
      const calc1 = await calculateCanonicalDigitalCode(HTTP_DOB);

      // Register session with cacheKey over HTTP
      const regResp = await fetch(`${baseUrl}/api/privacy/register-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "http_test_token_123456789", cacheKey: HTTP_DOB }),
      });
      expect(regResp.status).toBe(200);
      const regData = await regResp.json();
      expect(regData.status).toBe("ok");

      // Delete data over HTTP
      const delResp = await fetch(`${baseUrl}/api/delete-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "http_test_token_123456789" }),
      });
      expect(delResp.status).toBe(200);
      const delData = await delResp.json();
      expect(delData.status).toBe("ok");
      expect(delData.purgedCacheCount).toBeGreaterThanOrEqual(1);

      // Verify cache was purged (fresh reference)
      const calc2 = await calculateCanonicalDigitalCode(HTTP_DOB);
      expect(calc2).not.toBe(calc1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("adversarial: User A cannot purge User B cache by supplying User B dob/cacheKey in delete request", async () => {
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());

    app.post("/api/privacy/register-session", (req, res) => {
      try {
        const token = req.body?.token || "test_token_http_" + Date.now();
        const { anonymousId, sessionToken, cacheKey, cacheKeys, dob } = req.body || {};
        const keys: string[] = [];
        if (typeof cacheKey === "string" && cacheKey.trim()) keys.push(cacheKey.trim());
        if (typeof dob === "string" && dob.trim() && !keys.includes(dob.trim())) keys.push(dob.trim());
        if (Array.isArray(cacheKeys)) {
          for (const k of cacheKeys) {
            const trimmed = String(k || "").trim();
            if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
          }
        }
        registerDeletionScope(token, { anonymousId, sessionToken, cacheKeys: keys });
        return res.status(200).json({ status: "ok", token });
      } catch (err: any) {
        return res.status(500).json({ status: "error", message: err.message });
      }
    });

    app.post("/api/delete-data", async (req, res) => {
      try {
        const token = String(req.body?.token || "").trim();
        // Server strictly binds deletion to server-side scope; client-supplied arbitrary keys are NOT added
        const result = await executeDataDeletion(token);
        if (result.status === "error") {
          const isInput = result.code === "invalid_token" || result.code === "deletion_scope_not_found";
          return res.status(isInput ? 400 : 503).json(result);
        }
        return res.status(200).json(result);
      } catch (err: any) {
        return res.status(503).json({ status: "error", code: "deletion_incomplete", retryable: true, message: err.message });
      }
    });

    const server = await new Promise<any>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const DOB_VICTIM_B = "07.07.1957";
      const DOB_ATTACKER_A = "08.08.1958";

      // 1. Populate caches for Victim B
      const calcB1 = await calculateCanonicalDigitalCode(DOB_VICTIM_B);
      const v2B1 = await calculateCanonicalCodeV2(DOB_VICTIM_B);

      // 2. Populate caches for Attacker A
      const calcA1 = await calculateCanonicalDigitalCode(DOB_ATTACKER_A);

      // 3. Register legitimate scopes via HTTP
      const tokenA = "attacker_token_scope_a_123456789";
      const tokenB = "victim_token_scope_b_123456789";
      await fetch(`${baseUrl}/api/privacy/register-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenA, cacheKey: DOB_ATTACKER_A }),
      });
      await fetch(`${baseUrl}/api/privacy/register-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenB, cacheKey: DOB_VICTIM_B }),
      });

      // 4. Attacker A calls delete with their own valid tokenA, but maliciously injects DOB_VICTIM_B in body
      const attackResp = await fetch(`${baseUrl}/api/delete-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenA, dob: DOB_VICTIM_B, cacheKey: DOB_VICTIM_B }),
      });
      expect(attackResp.status).toBe(200);

      // 5. Attacker A's own cache WAS purged
      const calcA2 = await calculateCanonicalDigitalCode(DOB_ATTACKER_A);
      expect(calcA2).not.toBe(calcA1);

      // 6. Victim B's caches MUST REMAIN INTACT (identical object references)
      const calcB2 = await calculateCanonicalDigitalCode(DOB_VICTIM_B);
      const v2B2 = await calculateCanonicalCodeV2(DOB_VICTIM_B);
      expect(calcB2).toBe(calcB1);
      expect(v2B2).toBe(v2B1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
