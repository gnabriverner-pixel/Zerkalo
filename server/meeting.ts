import type { CalculationResult, FirstMirror, StoryInputs, MeetingApiResponse } from "../src/types";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import { parseMeetingResponse } from "../src/services/meetingContract";
import type { RequestRetryContext } from "./deepseek";
import { type ChatClient, fallbackEligible } from './routerai';
import { MEETING_SCHEMA, strictFormat } from './structuredOutput';

export const MEETING_GLOBAL_TIMEOUT_MS = 48_000; // <= 50s and strictly < 60s nginx proxy timeout

export interface GenerateMeetingParams {
  codeData: { calc: CalculationResult; firstMirror?: FirstMirror };
  storyData: { storyInputs: StoryInputs; storyResult: any };
  client: ChatClient;
  model?: string;
  totalBudgetMs?: number;
}

export async function generateMeetingOfMirrors(params: GenerateMeetingParams): Promise<MeetingApiResponse & {provider:string; model:string}> {
  const total = params.totalBudgetMs ?? MEETING_GLOBAL_TIMEOUT_MS;
  const deadline = Date.now() + total;
  try {
    return await generateMeetingAttempt({...params, totalBudgetMs:params.client.fallback ? Math.floor(total * 0.7) : total});
  } catch (error) {
    const fallback = fallbackEligible(error) ? params.client.fallback?.() : undefined;
    if (!fallback) throw error;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('meeting_timeout:deadline_exhausted');
    return await generateMeetingAttempt({...params, client:fallback,model:fallback.defaultModel,totalBudgetMs:remaining});
  }
}

async function generateMeetingAttempt({
  codeData,
  storyData,
  client,
  model = client.defaultModel || "deepseek-v4-pro",
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
        { role: "system", content: "Возвращай только валидный JSON без markdown. Сравнивай Код и Миф как два независимых взгляда, не устанавливай свойства человека. Ни один из них не считается истиной о человеке: смотри, какое новое различие появляется, если поставить их рядом. Единственный источник его актуальной ситуации — исходные ответы. В parallels.synthesis, summary и albertInsight говори о сходстве образов/тем, а не о подтверждённых качествах или причинах поведения. Нельзя называть бытовой выбор парализующим разрывом, а несовпадение обязательно объявлять дополнением. Новый ракурс формулируй как способ рассмотреть конкретную задачу, не объяснение истинной личности." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      // Stage 1.5 exhausted exactly 4000 completion tokens even with finish_reason=stop.
      // 6000 is bounded headroom; acceptance records actual consumption.
      max_tokens: client.name === 'routerai' ? 6000 : 4000,
      response_format: client.name === 'routerai' ? strictFormat('meeting', MEETING_SCHEMA) : { type: "json_object" },
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
      // Observed Stage 1.5 transport envelope. Unwrap exactly once, then subject the
      // complete inner envelope to the unchanged product parser (never fill fields).
      if (Object.keys(obj).length === 1 && typeof obj.result === 'object' && obj.result !== null
          && (obj.result as any).status === 'ok' && (obj.result as any).result) {
        normalizedRaw = obj.result;
      } else if (client.name !== 'routerai' && !obj.status && (obj.summary || obj.parallels || obj.resonances || obj.divergences)) {
        normalizedRaw = { status: "ok", result: obj };
      }
    }
    const validated = parseMeetingResponse(normalizedRaw);
    return {
      ...validated,
      provider: client.name || "deepseek",
      model: client.name === 'routerai' ? client.defaultModel! : model,
    };
  } catch (validationErr: any) {
    throw new Error(`meeting_malformed_response:${validationErr?.message || "contract_validation_failed"}`);
  }
}
