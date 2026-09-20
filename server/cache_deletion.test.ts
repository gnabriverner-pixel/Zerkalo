import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { calculateCanonicalDigitalCode, calculateCanonicalCodeV2, purgeCanonicalCaches } from "./dcsBridge";
import { registerDeletionScope, executeDataDeletion, registerCachePurger, bindSessionCalculationsToToken } from "./deletion";

describe("T1 Regression: Web DOB Cache Deletion Invariant", () => {
  beforeAll(() => {
    if (!process.env.DELETION_LOOKUP_SECRET || process.env.DELETION_LOOKUP_SECRET.length < 16) {
      process.env.DELETION_LOOKUP_SECRET = "test-deletion-secret-at-least-32-chars-long!";
    }
    registerCachePurger(purgeCanonicalCaches);
  });

  afterAll(() => {
    const scopesFile = process.env.DELETION_SCOPES_FILE;
    if (scopesFile && fs.existsSync(scopesFile)) {
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

    // Mount endpoints matching server.ts with server-trusted binding
    app.post("/api/calculate", async (req, res) => {
      try {
        const dob = String(req.body?.dob || "").trim();
        const result = await calculateCanonicalDigitalCode(dob);
        const deletionToken = String(req.headers["x-deletion-token"] || req.body?.token || "").trim();
        if (deletionToken) {
          registerDeletionScope(deletionToken, { cacheKey: dob });
        }
        return res.status(200).json({ status: "ok", result });
      } catch (err: any) {
        return res.status(400).json({ status: "error", message: err.message });
      }
    });

    app.post("/api/privacy/register-session", (req, res) => {
      try {
        const token = req.body?.token || "test_token_http_" + Date.now();
        const { anonymousId, sessionToken } = req.body || {};
        registerDeletionScope(token, { anonymousId, sessionToken });
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
      const HTTP_TOKEN = "http_test_token_123456789";

      // 1. Calculate DOB with server-trusted token binding over HTTP
      const calcResp = await fetch(`${baseUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deletion-token": HTTP_TOKEN },
        body: JSON.stringify({ dob: HTTP_DOB }),
      });
      expect(calcResp.status).toBe(200);

      // Verify calculation is cached
      const calc1 = await calculateCanonicalDigitalCode(HTTP_DOB);

      // 2. Delete data over HTTP
      const delResp = await fetch(`${baseUrl}/api/delete-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: HTTP_TOKEN }),
      });
      expect(delResp.status).toBe(200);
      const delData = await delResp.json();
      expect(delData.status).toBe("ok");
      expect(delData.purgedCacheCount).toBeGreaterThanOrEqual(1);

      // 3. Verify cache was purged (fresh reference)
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

    app.post("/api/calculate", async (req, res) => {
      try {
        const dob = String(req.body?.dob || "").trim();
        const result = await calculateCanonicalDigitalCode(dob);
        const deletionToken = String(req.headers["x-deletion-token"] || req.body?.token || "").trim();
        if (deletionToken) {
          registerDeletionScope(deletionToken, { cacheKey: dob });
        }
        return res.status(200).json({ status: "ok", result });
      } catch (err: any) {
        return res.status(400).json({ status: "error", message: err.message });
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
      const DOB_VICTIM_B = "07.07.1957";
      const DOB_ATTACKER_A = "08.08.1958";
      const tokenA = "attacker_token_scope_a_123456789";
      const tokenB = "victim_token_scope_b_123456789";

      // 1. Legitimate calculation for Victim B with tokenB
      await fetch(`${baseUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deletion-token": tokenB },
        body: JSON.stringify({ dob: DOB_VICTIM_B }),
      });
      const calcB1 = await calculateCanonicalDigitalCode(DOB_VICTIM_B);
      const v2B1 = await calculateCanonicalCodeV2(DOB_VICTIM_B);

      // 2. Legitimate calculation for Attacker A with tokenA
      await fetch(`${baseUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deletion-token": tokenA },
        body: JSON.stringify({ dob: DOB_ATTACKER_A }),
      });
      const calcA1 = await calculateCanonicalDigitalCode(DOB_ATTACKER_A);

      // 3. Attacker A calls delete with their own valid tokenA, but maliciously injects DOB_VICTIM_B in body
      const attackResp = await fetch(`${baseUrl}/api/delete-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenA, dob: DOB_VICTIM_B, cacheKey: DOB_VICTIM_B }),
      });
      expect(attackResp.status).toBe(200);

      // 4. Attacker A's own cache WAS purged
      const calcA2 = await calculateCanonicalDigitalCode(DOB_ATTACKER_A);
      expect(calcA2).not.toBe(calcA1);

      // 5. Victim B's caches MUST REMAIN INTACT (identical object references)
      const calcB2 = await calculateCanonicalDigitalCode(DOB_VICTIM_B);
      const v2B2 = await calculateCanonicalCodeV2(DOB_VICTIM_B);
      expect(calcB2).toBe(calcB1);
      expect(v2B2).toBe(v2B1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("User A cannot bind User B cache key during registration and later purge B using A deletion token", async () => {
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());

    // Matches secure server.ts: client-supplied dob / cacheKey in register-session are ignored
    app.post("/api/calculate", async (req, res) => {
      try {
        const dob = String(req.body?.dob || "").trim();
        const result = await calculateCanonicalDigitalCode(dob);
        const deletionToken = String(req.headers["x-deletion-token"] || req.body?.token || "").trim();
        if (deletionToken) {
          registerDeletionScope(deletionToken, { cacheKey: dob });
        }
        return res.status(200).json({ status: "ok", result });
      } catch (err: any) {
        return res.status(400).json({ status: "error", message: err.message });
      }
    });

    app.post("/api/privacy/register-session", (req, res) => {
      try {
        const token = req.body?.token || "test_token_reg_" + Date.now();
        const { anonymousId, sessionToken } = req.body || {};
        // Secure trust boundary: client-supplied dob/cacheKey/cacheKeys are strictly ignored
        registerDeletionScope(token, { anonymousId, sessionToken });
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
      const DOB_VICTIM_B = "09.09.1959";
      const DOB_ATTACKER_A = "10.10.1960";
      const tokenA = "attacker_token_reg_attack_123456789";
      const tokenB = "victim_token_reg_victim_123456789";

      // 1. Populate cache for Victim B with legitimate tokenB
      await fetch(`${baseUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deletion-token": tokenB },
        body: JSON.stringify({ dob: DOB_VICTIM_B }),
      });
      const calcB1 = await calculateCanonicalDigitalCode(DOB_VICTIM_B);

      // 2. Populate cache for Attacker A with legitimate tokenA
      await fetch(`${baseUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deletion-token": tokenA },
        body: JSON.stringify({ dob: DOB_ATTACKER_A }),
      });
      const calcA1 = await calculateCanonicalDigitalCode(DOB_ATTACKER_A);

      // 3. Attacker A calls register-session with tokenA, attempting to maliciously bind Victim B's DOB
      await fetch(`${baseUrl}/api/privacy/register-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenA, cacheKey: DOB_VICTIM_B, dob: DOB_VICTIM_B }),
      });

      // 4. Attacker A calls delete-data with tokenA
      const delResp = await fetch(`${baseUrl}/api/delete-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenA }),
      });
      expect(delResp.status).toBe(200);

      // 5. Attacker A's own cache WAS purged
      const calcA2 = await calculateCanonicalDigitalCode(DOB_ATTACKER_A);
      expect(calcA2).not.toBe(calcA1);

      // 6. Victim B's cache MUST REMAIN INTACT (server refused to bind Victim B's key to User A)
      const calcB2 = await calculateCanonicalDigitalCode(DOB_VICTIM_B);
      expect(calcB2).toBe(calcB1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
