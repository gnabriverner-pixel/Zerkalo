import type { CalculationResult, FirstMirror, StoryInputs, MeetingApiResponse } from "../src/types";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import { parseMeetingResponse } from "../src/services/meetingContract";
import { DeepSeekClient } from "./deepseek";

export interface GenerateMeetingParams {
  codeData: { calc: CalculationResult; firstMirror?: FirstMirror };
  storyData: { storyInputs: StoryInputs; storyResult: any };
  client: DeepSeekClient;
  model?: string;
  timeoutMs?: number;
}

export async function generateMeetingOfMirrors({
  codeData,
  storyData,
  client,
  model = "deepseek-v4-pro",
  timeoutMs = 45_000,
}: GenerateMeetingParams): Promise<MeetingApiResponse & { provider: string; model: string }> {
  if (!client.isReady()) {
    throw new Error("meeting_provider_not_ready");
  }

  const prompt = buildMeetingOfMirrorsPrompt(codeData, storyData);
  const responseText = await client.call({
    model,
    messages: [
      { role: "system", content: "Возвращай только валидный JSON без markdown." },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    timeoutMs,
  });

  let cleaned = responseText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(cleaned);
  } catch {
    const sanitized = cleaned.replace(/[\u0000-\u001F]+/g, (m) =>
      m === "\n" || m === "\r" || m === "\t" ? m : " "
    );
    parsedRaw = JSON.parse(sanitized);
  }

  const validated = parseMeetingResponse(parsedRaw);
  return {
    ...validated,
    provider: "deepseek",
    model,
  };
}
