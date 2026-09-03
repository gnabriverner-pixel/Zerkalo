import type { CalculationResult, FirstMirror, StoryInputs, MeetingApiResponse } from "../src/types";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import { parseMeetingResponse } from "../src/services/meetingContract";
import { DeepSeekClient, RequestRetryContext } from "./deepseek";

export const MEETING_GLOBAL_TIMEOUT_MS = 48_000; // <= 50s and strictly < 60s nginx proxy timeout

export interface GenerateMeetingParams {
  codeData: { calc: CalculationResult; firstMirror?: FirstMirror };
  storyData: { storyInputs: StoryInputs; storyResult: any };
  client: DeepSeekClient;
  model?: string;
  totalBudgetMs?: number;
}

export async function generateMeetingOfMirrors({
  codeData,
  storyData,
  client,
  model = "deepseek-v4-pro",
  totalBudgetMs = MEETING_GLOBAL_TIMEOUT_MS,
}: GenerateMeetingParams): Promise<MeetingApiResponse & { provider: string; model: string }> {
  if (!client.isReady()) {
    throw new Error("meeting_provider_not_ready");
  }

  const prompt = buildMeetingOfMirrorsPrompt(codeData, storyData);
  const deadlineMs = Date.now() + totalBudgetMs;
  const retryContext: RequestRetryContext = {
    retriesRemaining: 1,
    deadlineMs,
  };

  let responseText: string;
  try {
    responseText = await client.call({
      model,
      messages: [
        { role: "system", content: "Возвращай только валидный JSON без markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      timeoutMs: totalBudgetMs,
      retryContext,
    });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("timeout") || msg.includes("deadline_exhausted") || Date.now() >= deadlineMs) {
      throw new Error("meeting_timeout:deadline_exhausted");
    }
    throw err;
  }

  let cleaned = responseText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("meeting_malformed_response:no_json_braces");
  }
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(cleaned);
  } catch {
    const sanitized = cleaned.replace(/[\u0000-\u001F]+/g, (m) =>
      m === "\n" || m === "\r" || m === "\t" ? m : " "
    );
    try {
      parsedRaw = JSON.parse(sanitized);
    } catch {
      throw new Error("meeting_malformed_response:json_parse_failed");
    }
  }

  try {
    let normalizedRaw: unknown = parsedRaw;
    if (typeof parsedRaw === "object" && parsedRaw !== null) {
      const obj = parsedRaw as Record<string, unknown>;
      if (!obj.status && (obj.summary || obj.parallels || obj.resonances || obj.divergences)) {
        normalizedRaw = { status: "ok", result: obj };
      }
    }
    const validated = parseMeetingResponse(normalizedRaw);
    return {
      ...validated,
      provider: "deepseek",
      model,
    };
  } catch (validationErr: any) {
    throw new Error(`meeting_malformed_response:${validationErr?.message || "contract_validation_failed"}`);
  }
}
