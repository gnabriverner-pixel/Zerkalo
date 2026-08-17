import { describe, expect, it, vi } from "vitest";
import { DeepSeekClient } from "./deepseek";

describe("DeepSeek Transport Client", () => {
  it("fails immediately with zero retry if API key is missing or invalid", async () => {
    const client = new DeepSeekClient({ DEEPSEEK_API_KEY: "" });
    expect(client.isReady()).toBe(false);

    await expect(
      client.call({
        messages: [{ role: "user", content: "Привет" }],
      })
    ).rejects.toThrow("deepseek_not_ready");
  });

  it("does not retry terminal 4xx errors (e.g. 401 Unauthorized)", async () => {
    let callCount = 0;
    const customFetch = vi.fn(async () => {
      callCount += 1;
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        statusText: "Unauthorized",
      });
    });

    const client = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
      DEEPSEEK_BASE_URL: "https://api.deepseek.test",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = customFetch as any;

    try {
      await expect(
        client.call({
          messages: [{ role: "user", content: "Привет" }],
        })
      ).rejects.toThrow("provider_http_401");

      expect(callCount).toBe(1); // Zero retry on 401
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("retries transient 5xx errors exactly once", async () => {
    let callCount = 0;
    const customFetch = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response("Server error", { status: 503, statusText: "Service Unavailable" });
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ mode: "story", status: "ok" }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    });

    const client = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
      DEEPSEEK_BASE_URL: "https://api.deepseek.test",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = customFetch as any;

    try {
      const result = await client.call({
        messages: [{ role: "user", content: "Привет" }],
      });

      expect(callCount).toBe(2); // Retried once and succeeded
      expect(result).toContain('"status":"ok"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails closed on empty provider output", async () => {
    const customFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "   " } }],
        }),
        { status: 200 }
      );
    });

    const client = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
      DEEPSEEK_BASE_URL: "https://api.deepseek.test",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = customFetch as any;

    try {
      await expect(
        client.call({
          messages: [{ role: "user", content: "Привет" }],
        })
      ).rejects.toThrow("provider_empty_output");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
