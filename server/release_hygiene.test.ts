import { describe, it, expect, beforeAll, afterAll } from "vitest";
import child_process from "child_process";
import path from "path";

const repoRoot = path.resolve(__dirname, "..");

describe("Release Hygiene Production Server Suite", () => {
  let serverProc: child_process.ChildProcess;
  const testPort = 39800 + Math.floor(Math.random() * 150);
  const baseUrl = `http://127.0.0.1:${testPort}`;
  let consentCookie = "";

  beforeAll(async () => {
    const tsxPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
    serverProc = child_process.spawn(
      process.execPath,
      [tsxPath, "server.ts"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PORT: String(testPort),
          NODE_ENV: "production",
          PUBLIC_RELEASE_MODE: "1",
          ALLOW_TEST_SCENARIOS: "0",
          MYTH_ENABLED: "1",
          PUBLIC_CODE_ENABLED: "1",
          PUBLIC_MEETING_ENABLED: "1",
          PUBLIC_ALBERT_ENABLED: "1",
          PUBLIC_BOOK_ENABLED: "0",
          PAYMENTS_ENABLED: "0",
          CONTINUATION_CLAIM_SECRET: "test-secret-at-least-16-chars-long!",
          DELETION_LOOKUP_SECRET: "test-deletion-secret-at-least-16-chars!",
          DCS_ROOT: process.env.DCS_ROOT || path.resolve(repoRoot, "..", "digital-code-system"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    // Poll until server is ready
    const start = Date.now();
    let online = false;
    while (Date.now() - start < 15_000) {
      try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) {
          online = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!online) {
      serverProc.kill("SIGKILL");
      throw new Error(`Server failed to boot in production mode on port ${testPort}`);
    }

    // Acquire valid adult consent cookie for authenticated endpoint checks
    const consentRes = await fetch(`${baseUrl}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({
        accepted: true,
        adult: true,
        version: "zerkalo-2026-09-v1",
        scope: "core",
      }),
    });
    consentCookie = consentRes.headers.get("set-cookie")?.split(";")[0] || "";
  }, 20_000);

  afterAll(async () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
      if (!serverProc.killed) {
        serverProc.kill("SIGKILL");
      }
    }
  });

  describe("Lab and Fixture Endpoints are Closed in Production", () => {
    it("GET /api/ab-fixtures returns 404 in production", async () => {
      const res = await fetch(`${baseUrl}/api/ab-fixtures`);
      expect(res.status).toBe(404);
      const json = await res.json().catch(() => ({}));
      expect(json.status).toBe("error");
    });

    it("POST /api/lab/meeting/generate alias is completely removed and returns 404 (with or without cookie)", async () => {
      const res = await fetch(`${baseUrl}/api/lab/meeting/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: consentCookie },
        body: JSON.stringify({ test: true }),
      });
      // In production Express static + SPA setup, unrouted POST paths return 404
      expect(res.status).toBe(404);
    });

    it("POST /api/lab/albert/dialogue alias is completely removed and returns 404 (with or without cookie)", async () => {
      const res = await fetch(`${baseUrl}/api/lab/albert/dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: consentCookie },
        body: JSON.stringify({ question: "Привет" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("Canonical Production Endpoints Remain Active", () => {
    it("POST /api/meeting-of-mirrors is active (validates payload requirements)", async () => {
      // With valid consent cookie and empty payload, meetingHandler validates input
      const res = await fetch(`${baseUrl}/api/meeting-of-mirrors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: consentCookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("error");
      expect(json.ui?.safe_message).toContain("Для встречи зеркал необходимы");
    });

    it("POST /api/albert/dialogue is active (validates input requirements)", async () => {
      // With valid consent cookie and empty question, albertHandler validates input
      const res = await fetch(`${baseUrl}/api/albert/dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: consentCookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.status).toBe("error");
      expect(json.ui?.safe_message).toContain("текст вопроса");
    });

    it("POST /api/calculate is active and protected by consent", async () => {
      // Without consent: 403
      const unauth = await fetch(`${baseUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob: "06.05.1986" }),
      });
      expect(unauth.status).toBe(403);

      // With consent: 200
      const auth = await fetch(`${baseUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: consentCookie },
        body: JSON.stringify({ dob: "06.05.1986" }),
      });
      expect(auth.status).toBe(200);
      const json = await auth.json();
      expect(json.status).toBe("ok");
      expect(json.result.soul).toBe(6);
    });

    it("POST /api/code-v2 is active and protected by consent", async () => {
      // Without consent: 403
      const unauth = await fetch(`${baseUrl}/api/code-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob: "06.05.1986" }),
      });
      expect(unauth.status).toBe(403);

      // With consent: 200
      const auth = await fetch(`${baseUrl}/api/code-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: consentCookie },
        body: JSON.stringify({ dob: "06.05.1986" }),
      });
      expect(auth.status).toBe(200);
      const json = await auth.json();
      expect(json.status).toBe("ok");
      expect(json.payload.calculation.five_numbers.soul).toBe(6);
    });
  });
});
