// server/myth.ts
// Лаборатория «Зеркало себя» — Личный миф (Gate 1).
// DeepSeek V4 (deepseek-v4-flash / deepseek-v4-pro), non-thinking по умолчанию.
// Writer и safety разделены: writer-prompt отвечает только за литературу;
// crisis-проверка, schema-валидация и сканер запрещённой лексики — после генерации.
// Нет fake success: любая неудача — честная ошибка.

import type { StoryInputs } from "../src/types";

export type PersonalMythAnswerKey = "q1" | "q2" | "q3" | "q4";

export type PersonalMythAnswers = StoryInputs;

export interface PersonalMythRequest {
  request_id: string;
  consent_version: string;
  answers: PersonalMythAnswers;
}

export interface PersonalMythResult {
  title: string;
  story: string;
  mirror: {
    mainImage: string;
    innerTension: string;
    hiddenResource: string;
    newView: string;
  };
  meaning: string[];
  one_step: string;
  journal_question: string;
  disclaimer: string;
}

export interface PersonalMythQualityReport {
  passed: boolean;
  blockers: string[];
  word_count: number;
}

export interface PersonalMythProvider {
  readonly name: string;
  readonly model: string;
  isReady(): boolean;
  generate(prompt: string, timeoutMs: number): Promise<string>;
}

const ANSWER_KEYS: PersonalMythAnswerKey[] = ["q1", "q2", "q3", "q4"];

// Жёсткие границы объёма — sanity-проверка транспорта, не литературный шаблон.
const STORY_WORDS_MIN = 150;
const STORY_WORDS_MAX = 1200;

const FORBIDDEN_PUBLIC_LANGUAGE = [
  /терап(?:ия|евт\w*)/iu,
  /психотерап\w*/iu,
  /гипноз\w*/iu,
  /(?:^|\s)нлп(?:$|\s|[.,!?;:])/iu,
  /леч(?:ение|ить|ит)(?:$|\s|[.,!?;:])/iu,
  /диагноз\w*/iu,
  /исцел\w*/iu,
  /предсказ\w*/iu,
  /магическ\w*/iu,
  /карм\w*/iu,
  /(?:^|\s)вы\s+(?:точно|обязательно|должны)(?:$|\s|[.,!?;:])/iu,
  /вс[её]\s+будет\s+хорошо/iu,
];

const CRISIS_LANGUAGE = [
  /хочу\s+(?:умереть|покончить\s+с\s+собой)/iu,
  /не\s+хочу\s+жить/iu,
  /убить\s+себя/iu,
  /причин(?:ить|ю)\s+(?:себе|другим)\s+вред/iu,
  /суицид\w*/iu,
  /самоубийств\w*/iu,
  /наложить\s+на\s+себя\s+руки/iu,
  /вскрыть\s+вены/iu,
  /спрыгнуть\s+с/iu,
  /покончить\s+с\s+собой/iu,
];

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
}

export function parsePersonalMythRequest(value: unknown): PersonalMythRequest {
  if (!isRecord(value) || !isRecord(value.answers)) {
    throw new Error("invalid_request_shape");
  }
  const requestId = cleanText(value.request_id);
  const consentVersion = cleanText(value.consent_version || "personal-myth-v1");
  if (!/^[a-zA-Z0-9_-]{12,80}$/u.test(requestId)) {
    throw new Error("invalid_request_id");
  }
  const answers = {} as PersonalMythAnswers;
  for (const key of ANSWER_KEYS) {
    const answer = cleanText(value.answers[key]);
    if (answer.length < 3 || answer.length > 1000) {
      throw new Error(`invalid_answer:${key}`);
    }
    answers[key] = answer;
  }
  return { request_id: requestId, consent_version: consentVersion, answers };
}

export function containsCrisisLanguage(answers: PersonalMythAnswers): boolean {
  const combined = ANSWER_KEYS.map((key) => answers[key] ?? "").join(" ");
  return CRISIS_LANGUAGE.some((pattern) => pattern.test(combined));
}

export function parsePersonalMythResult(raw: string): PersonalMythResult {
  const parsed = JSON.parse(stripCodeFence(raw)) as unknown;
  if (!isRecord(parsed)) throw new Error("result_not_object");
  const result = (isRecord(parsed.story_result) ? parsed.story_result : parsed) as Record<string, unknown>;
  if (!isRecord(result.mirror)) throw new Error("result_shape_invalid");

  const mirror = result.mirror as Record<string, unknown>;
  const meaning = Array.isArray(result.meaning)
    ? result.meaning.map((item) => cleanText(item)).filter(Boolean)
    : [];

  return {
    title: cleanText(result.title),
    story: cleanText(result.story),
    mirror: {
      mainImage: cleanText(mirror.mainImage),
      innerTension: cleanText(mirror.innerTension),
      hiddenResource: cleanText(mirror.hiddenResource),
      newView: cleanText(mirror.newView),
    },
    meaning,
    one_step: cleanText(result.one_step),
    journal_question: cleanText(result.journal_question),
    disclaimer: cleanText(result.disclaimer) || "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
  };
}

export function validatePersonalMythResult(result: PersonalMythResult): PersonalMythQualityReport {
  const blockers: string[] = [];
  const wordCount = result.story.split(/\s+/u).filter(Boolean).length;

  if (result.title.length < 3 || result.title.length > 120) blockers.push("title_length");
  if (wordCount < STORY_WORDS_MIN || wordCount > STORY_WORDS_MAX) {
    blockers.push(`story_word_count (фактически ${wordCount}, требуется ${STORY_WORDS_MIN}–${STORY_WORDS_MAX})`);
  }
  if (result.one_step.length < 10 || result.one_step.length > 500) blockers.push("one_step_contract");
  if (result.journal_question.length < 10 || result.journal_question.length > 300) {
    blockers.push("journal_question_contract");
  }
  const mirrorValues = Object.values(result.mirror);
  if (mirrorValues.length !== 4 || mirrorValues.some((value) => value.length < 3)) {
    blockers.push("mirror_contract");
  }

  const publicText = [
    result.title,
    result.story,
    ...mirrorValues,
    ...result.meaning,
    result.one_step,
    result.journal_question,
  ].join(" ");
  if (FORBIDDEN_PUBLIC_LANGUAGE.some((pattern) => pattern.test(publicText))) {
    blockers.push("forbidden_public_language");
  }

  return {
    passed: blockers.length === 0,
    blockers: [...new Set(blockers)],
    word_count: wordCount,
  };
}

export function buildPersonalMythPrompt(
  request: PersonalMythRequest,
  repairBlockers: string[] = [],
): string {
  const repairInstruction = repairBlockers.length
    ? `\nПредыдущая версия не прошла проверку: ${repairBlockers.join(", ")}. Перепиши историю полностью и исправь эти причины, сохранив её живой и литературной.`
    : "";
  return `Ты — русскоязычный писатель. Напиши «Личный миф» — взрослую литературную историю для человека, который хочет увидеть своё нынешнее состояние со стороны. Это не консультация, не разбор и не совет: история вместо совета.

Четыре ответа человека:
1. Что требует внимания (ощущение): ${request.answers.q1}
2. Образ состояния: ${request.answers.q2}
3. Момент живости и ясности: ${request.answers.q3}
4. Недостающее качество: ${request.answers.q4}

Как писать:
- Язык — живой, точный, сильный русский. Текст должен звучать как написанный зрелым автором, а не как ответ специалиста.
- Опирайся только на эти четыре образа: оживи их в одной цельной истории, не пересказывая ответы буквально.
- Двигайся сценами и конкретными деталями: свет, звук, пространство, материя, жест. Без абстрактной псевдоглубины и «возвышенных» обобщений.
- Форма: мир героя и привычное движение → нарушение равновесия (образ 1) → встреча с центральным образом (образ 2) → проблеск живости (образ 3) → недостающее качество (образ 4) → мягкий поворот взгляда и открытый финал.
- Один шаг — простое земное действие на сегодня (не более пятнадцати минут), не обещающее внутреннюю перемену. Вопрос для дневника — открытый, без подсказанного ответа.
- Не ставь диагнозов, не предсказывай будущее, не морализируй, не обещай «всё будет хорошо». Никаких канцеляризмов («данная ситуация может свидетельствовать», «вам необходимо», «рекомендуется рассмотреть»).
- Объём истории — 350–700 слов, абзацы через двойной перенос строки.${repairInstruction}

Верни только валидный JSON без markdown-разметки:
{
  "mode": "story",
  "status": "ok",
  "story_result": {
    "title": "Точное, поэтичное название истории",
    "story": "Полный текст истории (абзацы через \\n\\n)",
    "mirror": {
      "mainImage": "Короткое ёмкое описание центрального образа и его скрытого значения (2–3 предложения)",
      "innerTension": "В чём на самом деле скрытое напряжение (2–3 предложения)",
      "hiddenResource": "В чём обнаруженная сила и точка опоры (2–3 предложения)",
      "newView": "Как меняется угол зрения на текущую ситуацию (2–3 предложения)"
    },
    "meaning": [
      "Ключевая метафора и её значение",
      "Скрытая точка выбора",
      "Движение от замирания к ясности"
    ],
    "one_step": "Одно конкретное простое действие на сегодня (1–2 предложения)",
    "journal_question": "Один живой открытый вопрос для дневника",
    "disclaimer": "Образный формат для саморефлексии. Не диагностика и не инструкция к действию."
  }
}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface MythRuntimeOptions {
  model: string;
  temperature: number;
  thinking: "off" | "high" | "max";
  reasoningEffort: "high" | "max";
}

export class DeepSeekMythProvider implements PersonalMythProvider {
  readonly name = "deepseek" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly temperature: number;
  private readonly thinking: "off" | "high" | "max";
  private readonly reasoningEffort: "high" | "max";

  constructor(env: NodeJS.ProcessEnv, options?: Partial<MythRuntimeOptions>) {
    this.apiKey = cleanText(env.DEEPSEEK_API_KEY);
    this.model = cleanText(options?.model || env.PERSONAL_MYTH_MODEL || "deepseek-v4-flash");
    this.baseUrl = cleanText(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/u, "");
    this.temperature = Number(env.LAB_MYTH_TEMPERATURE || options?.temperature || 0.72);
    const thinking = cleanText(env.LAB_MYTH_THINKING || options?.thinking || "off");
    this.thinking = thinking === "high" || thinking === "max" ? thinking : "off";
    const effort = cleanText(env.LAB_MYTH_REASONING_EFFORT || options?.reasoningEffort || "high");
    this.reasoningEffort = effort === "max" ? "max" : "high";
  }

  isReady(): boolean {
    return this.apiKey.length >= 20 && this.model.length >= 3;
  }

  private buildBody(prompt: string) {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: "Возвращай только валидный JSON без markdown." },
        { role: "user", content: prompt },
      ],
      temperature: this.temperature,
      max_tokens: 5000,
      response_format: { type: "json_object" },
    };
    // DeepSeek V4: режим thinking должен быть ЯВНЫМ (по умолчанию API включает thinking,
    // и content может оказаться пустым, пока reasoning пожирает max_tokens).
    // Non-thinking (дефолт лаборатории): thinking.type=disabled — проверено эмпирически
    // и соответствует официальному guide thinking_mode.
    // Thinking (эксперимент): одинаково для обеих моделей A/B, уровень из env.
    if (this.thinking === "off") {
      body.thinking = { type: "disabled" };
    } else {
      body.thinking = { type: "enabled" };
      body.reasoning_effort = this.reasoningEffort;
    }
    return body;
  }

  async generate(prompt: string, timeoutMs: number): Promise<string> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.buildBody(prompt)),
      },
      timeoutMs,
    );
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const payload = (await response.json()) as Record<string, any>;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("provider_empty_output");
    return content;
  }
}

export function createMythProvider(env: NodeJS.ProcessEnv, options?: Partial<MythRuntimeOptions>): PersonalMythProvider {
  return new DeepSeekMythProvider(env, options);
}

export async function generatePersonalMyth(
  request: PersonalMythRequest,
  provider: PersonalMythProvider,
  timeoutMs: number,
): Promise<{ result: PersonalMythResult; quality: PersonalMythQualityReport; repaired: boolean }> {
  if (!provider.isReady()) throw new Error("personal_myth_provider_not_ready");

  let blockers: string[] = [];
  let lastQuality: PersonalMythQualityReport | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const prompt = buildPersonalMythPrompt(request, blockers);
      let raw = "";
      let transportError: unknown = null;
      for (let transportAttempt = 0; transportAttempt < 2; transportAttempt += 1) {
        try {
          raw = await provider.generate(prompt, timeoutMs);
          transportError = null;
          break;
        } catch (error) {
          transportError = error;
        }
      }
      if (transportError) throw transportError;
      const result = parsePersonalMythResult(raw);
      const quality = validatePersonalMythResult(result);
      if (quality.passed) return { result, quality, repaired: attempt === 1 };
      lastQuality = quality;
      blockers = quality.blockers;
    } catch (error) {
      blockers = [error instanceof Error ? error.message.split(":", 1)[0] : "result_parse_failed"];
    }
  }
  const finalBlockers = blockers.join("|");
  const metrics = lastQuality ? `;word_count=${lastQuality.word_count}` : "";
  throw new Error(`personal_myth_quality_failed:${finalBlockers}${metrics}`);
}
