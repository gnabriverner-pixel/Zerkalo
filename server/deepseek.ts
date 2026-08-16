export interface DeepSeekChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekRequestOptions {
  messages: DeepSeekChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  timeoutMs?: number;
}

export class DeepSeekClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly defaultModel: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = String(env.DEEPSEEK_API_KEY ?? "").trim();
    this.baseUrl = String(env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").trim().replace(/\/+$/u, "");
    this.defaultModel = String(env.DEEPSEEK_MODEL || env.PERSONAL_MYTH_MODEL || "deepseek-v4-pro").trim();
  }

  isReady(): boolean {
    return this.apiKey.length >= 20;
  }

  isTransientError(error: unknown, status?: number): boolean {
    if (status !== undefined) {
      // 408 Request Timeout, 409 Conflict, 429 Too Many Requests, 5xx Server Errors
      return status === 408 || status === 409 || status === 429 || (status >= 500 && status <= 599);
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      const name = error.name.toLowerCase();
      if (
        name.includes("abort") ||
        name.includes("timeout") ||
        msg.includes("timeout") ||
        msg.includes("econnreset") ||
        msg.includes("econnrefused") ||
        msg.includes("fetch failed") ||
        msg.includes("network")
      ) {
        return true;
      }
    }
    return false;
  }

  async call(options: DeepSeekRequestOptions): Promise<string> {
    if (!this.isReady()) {
      throw new Error("deepseek_not_ready:missing_or_invalid_api_key");
    }

    const model = options.model || this.defaultModel;
    const timeoutMs = options.timeoutMs ?? 45_000;
    const maxAttempts = 2; // Initial attempt + at most 1 retry for transient failure

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const body: Record<string, unknown> = {
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 4000,
          thinking: { type: "disabled" },
        };

        if (options.response_format) {
          body.response_format = options.response_format;
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const status = response.status;
          let errBody = "";
          try {
            errBody = await response.text();
          } catch {
            // ignore
          }

          const isTransient = this.isTransientError(null, status);
          const errorMsg = `provider_http_${status}:${errBody.slice(0, 150)}`;
          const err = new Error(errorMsg);

          if (isTransient && attempt < maxAttempts) {
            console.warn(`[DeepSeekClient] Transient HTTP ${status} on attempt ${attempt}. Retrying once...`);
            lastError = err;
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }

          // Terminal failure or retry exhausted
          throw err;
        }

        const payload = (await response.json()) as Record<string, any>;
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("provider_empty_output");
        }

        return content;
      } catch (err: any) {
        clearTimeout(timer);

        const isTransient = this.isTransientError(err);
        if (isTransient && attempt < maxAttempts) {
          console.warn(`[DeepSeekClient] Transient error (${err.message}) on attempt ${attempt}. Retrying once...`);
          lastError = err instanceof Error ? err : new Error(String(err));
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error("provider_call_failed");
  }
}
