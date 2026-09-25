import crypto from "crypto";
import type { CalculationResult, FirstMirror, StoryInputs, MeetingApiResponse, CodeV2Payload } from "../src/types";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import { parseMeetingResponse } from "../src/services/meetingContract";
import { containsCrisisLanguageText } from "./myth";
import type { RequestRetryContext } from "./deepseek";
import { type ChatClient, fallbackEligible } from './routerai';
import { MEETING_SCHEMA, strictFormat } from './structuredOutput';

export const MEETING_GLOBAL_TIMEOUT_MS = 48_000; // <= 50s and strictly < 60s nginx proxy timeout

export function containsMeetingCrisisInput(storyData: any, userQuestion?: string): boolean {
  const inputs = storyData?.storyInputs || {};
  const parts: string[] = [
    String(userQuestion ?? ""),
    String(storyData?.userQuestion ?? ""),
    String(inputs.q1 ?? ""),
    String(inputs.q2 ?? ""),
    String(inputs.q3 ?? ""),
    String(inputs.q4 ?? ""),
    String(inputs.q5 ?? ""),
  ];
  return parts.some((text) => text.trim().length > 0 && containsCrisisLanguageText(text));
}

export function deriveMeetingCacheKey(codeData: any, storyData: any, userQuestion?: string): string {
  const normalizedQuestion = String(userQuestion ?? storyData?.userQuestion ?? "").trim().slice(0, 500);
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        calc: codeData?.calc,
        firstMirrorVersion: codeData?.firstMirror?.interpretationVersion || "",
        firstMirrorTitle: codeData?.firstMirror?.title || "",
        firstMirrorKeyInsight: codeData?.firstMirror?.keyInsight || "",
        codeV2Motif: codeData?.codeV2Payload?.central_motif || "",
        codeReactions: codeData?.codeReactions || {},
        storyInputs: storyData?.storyInputs,
        storyTitle: storyData?.storyResult?.title || "",
        storyMirror: storyData?.storyResult?.mirror || {},
        userQuestion: normalizedQuestion,
      }),
    )
    .digest("hex");
}

export interface GenerateMeetingParams {
  codeData: {
    calc: CalculationResult;
    firstMirror?: FirstMirror;
    codeV2Payload?: CodeV2Payload;
    codeReactions?: Record<string, "confirmed" | "rejected">;
  };
  storyData: { storyInputs: StoryInputs; storyResult: any; userQuestion?: string };
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

const MEETING_SYSTEM_PROMPT =
  "Возвращай только валидный JSON без markdown. Сравнивай Код и Миф как два независимых взгляда, не устанавливай свойства личности. Обращайся к человеку НАПРЯМУЮ («вы», «ваш», «в вашем ответе», «для вашей ситуации»); категорически запрещено обсуждать человека в третьем лице («человек», «читатель», «пользователь», «автор ответов»). Строго различай происхождение ответов: 1) личный вопрос и q1 — актуальная ситуация (действия или цитаты коллег и других людей из q1 нельзя приписывать самому пользователю), 2) q2 — образ состояния, 3) q3 («Точка живости») — оценивай по содержанию: явно описанный реальный жизненный/рабочий опыт разрешается пересказывать как сообщение самого человека; воображаемую сцену (курьер, папка, закрытая дверь, маяк и т. п.) сохраняй строго как образ («в выбранном вами образе...»); при неизвестном ресурсе («не знаю») прямо фиксируй, что готовой испытанной опоры в ответах пока не названо; при неоднозначности используй «в вашем ответе...» и гипотезу без утверждения о биографии, 4) q4 («Чего хочется больше») — желаемое направление, которое нельзя выдавать за уже освоенную способность («вы уже умеете...»), 5) художественный текст Мифа (storyResult) — отдельный литературный источник, его новые детали нельзя приписывать словам пользователя. Запрещены обещания результата («ночная переделка становится менее неизбежной», «снизит риск ночных переделок»).";

function parseAndValidateMeetingText(
  responseText: string,
  clientName: string | undefined,
  storyData: GenerateMeetingParams["storyData"],
) {
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

  let normalizedRaw: unknown = parsedRaw;
  if (typeof parsedRaw === "object" && parsedRaw !== null) {
    const obj = parsedRaw as Record<string, unknown>;
    if (Object.keys(obj).length === 1 && typeof obj.result === 'object' && obj.result !== null
        && (obj.result as any).status === 'ok' && (obj.result as any).result) {
      normalizedRaw = obj.result;
    } else if (clientName !== 'routerai' && !obj.status && (obj.summary || obj.parallels || obj.resonances || obj.divergences)) {
      normalizedRaw = { status: "ok", result: obj };
    }
  }
  return parseMeetingResponse(normalizedRaw, storyData);
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
        { role: "system", content: MEETING_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
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

  try {
    const validated = parseAndValidateMeetingText(responseText, client.name, storyData);
    return {
      ...validated,
      provider: client.name || "deepseek",
      model: client.name === 'routerai' ? client.defaultModel! : model,
    };
  } catch (validationErr: any) {
    const reason = String(validationErr?.message || "contract_validation_failed");
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs > 4000) {
      const repairPrompt = `${prompt}\n\nВАЖНО — ИСПРАВЛЕНИЕ НАРУШЕНИЯ КОНТРАКТА (${reason}):\nПредыдущий черновик нарушил правило (${reason}). Перепиши JSON так, чтобы:\n1) Обращаться к человеку строго напрямую на «вы / ваш» (без обсуждения в третьем лице «человек / пользователь / читатель»).\n2) Точно соблюдать происхождение ответов: q1 и личный вопрос — актуальная ситуация (действия коллег не приписывать пользователю); q2 — образ состояния; q3 — если описан реальный жизненный/рабочий опыт, можно пересказать как сообщение самого человека, если воображаемая сцена — обозначить как «в выбранном вами образе...», если «не знаю» — прямо сказать, что готовой испытанной опоры пока не видно; q4 — желаемое направление, а не уже освоенный навык («вы уже умеете...» запрещено); детали, появившиеся только в тексте Мифа (storyResult), ссылать только на «в тексте Мифа».\n3) Не обещать результат («становится менее неизбежной», «снизит риск переделок»).\nЧерновик для исправления:\n${responseText}`;
      try {
        const repairedText = await client.call({
          model,
          messages: [
            { role: "system", content: MEETING_SYSTEM_PROMPT },
            { role: "user", content: repairPrompt },
          ],
          temperature: 0.4,
          max_tokens: client.name === 'routerai' ? 6000 : 4000,
          response_format: client.name === 'routerai' ? strictFormat('meeting', MEETING_SCHEMA) : { type: "json_object" },
          timeoutMs: remainingMs,
          retryContext: { retriesRemaining: 0, deadlineMs },
        });
        const validatedRepair = parseAndValidateMeetingText(repairedText, client.name, storyData);
        return {
          ...validatedRepair,
          provider: client.name || "deepseek",
          model: client.name === 'routerai' ? client.defaultModel! : model,
        };
      } catch (repairErr: any) {
        throw new Error(`meeting_malformed_response:${repairErr?.message || reason}`);
      }
    }
    throw new Error(`meeting_malformed_response:${reason}`);
  }
}
