import { GoogleGenAI } from "@google/genai";

export type PersonalMythAnswerKey = "q1" | "q2" | "q3" | "q4";

export type PersonalMythAnswers = Record<PersonalMythAnswerKey, string>;

export type PersonalMythVisualKey =
  | "threshold"
  | "forest_path"
  | "quiet_room"
  | "river_crossing"
  | "night_window"
  | "open_field";

export interface PersonalMythEcho {
  answer_key: PersonalMythAnswerKey;
  source_phrase: string;
  story_image: string;
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
  answer_echoes: PersonalMythEcho[];
  one_step: string;
  journal_question: string;
  visual_key: PersonalMythVisualKey;
  disclaimer: string;
}

export interface PersonalMythRequest {
  request_id: string;
  consent_version: string;
  answers: PersonalMythAnswers;
}

export interface PersonalMythQualityReport {
  passed: boolean;
  blockers: string[];
  word_count: number;
  answer_coverage: PersonalMythAnswerKey[];
}

export interface PersonalMythProvider {
  readonly name: "deepseek" | "gemini";
  readonly model: string;
  isReady(): boolean;
  generate(prompt: string, timeoutMs: number): Promise<string>;
}

const ANSWER_KEYS: PersonalMythAnswerKey[] = ["q1", "q2", "q3", "q4"];
const VISUAL_KEYS = new Set<PersonalMythVisualKey>([
  "threshold",
  "forest_path",
  "quiet_room",
  "river_crossing",
  "night_window",
  "open_field",
]);

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
  /(?:^|\s)вы\s+(?:точно|обязательно|должны)(?:$|\s|[.,!?;:])/iu,
  /вс[её]\s+будет\s+хорошо/iu,
];

const CRISIS_LANGUAGE = [
  /хочу\s+(?:умереть|покончить\s+с\s+собой)/iu,
  /не\s+хочу\s+жить/iu,
  /убить\s+себя/iu,
  /причин(?:ить|ю)\s+(?:себе|другим)\s+вред/iu,
];

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function normalizeForMatch(value: string): string {
  return cleanText(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/gu, "е")
    .replace(/[^а-яa-z0-9\s-]/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function words(value: string): string[] {
  return normalizeForMatch(value).split(" ").filter((token) => token.length >= 3);
}

function phraseBelongsToAnswer(phrase: string, answer: string): boolean {
  const normalizedPhrase = normalizeForMatch(phrase);
  const normalizedAnswer = normalizeForMatch(answer);
  if (!normalizedPhrase || !normalizedAnswer) return false;
  if (normalizedAnswer.includes(normalizedPhrase)) return true;
  const answerTokens = new Set(words(answer));
  const phraseTokens = words(phrase);
  return phraseTokens.length > 0 && phraseTokens.every((token) => answerTokens.has(token));
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
  const combined = Object.values(answers).join(" ");
  return CRISIS_LANGUAGE.some((pattern) => pattern.test(combined));
}

export function parsePersonalMythResult(raw: string): PersonalMythResult {
  const parsed = JSON.parse(stripCodeFence(raw)) as unknown;
  if (!isRecord(parsed)) throw new Error("result_not_object");
  const result = (isRecord(parsed.story_result) ? parsed.story_result : parsed) as Record<string, unknown>;
  if (!isRecord(result.mirror) || !Array.isArray(result.answer_echoes)) {
    throw new Error("result_shape_invalid");
  }

  const answerEchoes = result.answer_echoes.map((entry) => {
    if (!isRecord(entry) || !ANSWER_KEYS.includes(entry.answer_key as PersonalMythAnswerKey)) {
      throw new Error("answer_echo_invalid");
    }
    return {
      answer_key: entry.answer_key as PersonalMythAnswerKey,
      source_phrase: cleanText(entry.source_phrase),
      story_image: cleanText(entry.story_image),
    };
  });
  const visualKey = cleanText(result.visual_key) as PersonalMythVisualKey;
  if (!VISUAL_KEYS.has(visualKey)) throw new Error("visual_key_invalid");
  const story = Array.isArray(result.story_parts)
    ? result.story_parts.map((part) => String(part ?? "").trim()).filter(Boolean).join("\n\n")
    : String(result.story ?? "").trim();

  return {
    title: cleanText(result.title),
    story,
    mirror: {
      mainImage: cleanText(result.mirror.mainImage),
      innerTension: cleanText(result.mirror.innerTension),
      hiddenResource: cleanText(result.mirror.hiddenResource),
      newView: cleanText(result.mirror.newView),
    },
    answer_echoes: answerEchoes,
    one_step: cleanText(result.one_step),
    journal_question: cleanText(result.journal_question),
    visual_key: visualKey,
    disclaimer: cleanText(result.disclaimer),
  };
}

export function validatePersonalMythResult(
  result: PersonalMythResult,
  answers: PersonalMythAnswers,
): PersonalMythQualityReport {
  const blockers: string[] = [];
  const wordCount = result.story.split(/\s+/u).filter(Boolean).length;
  if (result.title.length < 3 || result.title.length > 120) blockers.push("title_length");
  if (wordCount < 280 || wordCount > 700) blockers.push("story_word_count");
  if (result.one_step.length < 20 || result.one_step.length > 420) blockers.push("one_step_contract");
  if (result.journal_question.length < 15 || result.journal_question.length > 260) {
    blockers.push("journal_question_contract");
  }
  if (!result.story.includes("\n\n")) blockers.push("story_paragraphs_missing");

  const publicText = [
    result.title,
    result.story,
    ...Object.values(result.mirror),
    result.one_step,
    result.journal_question,
  ].join(" ");
  if (FORBIDDEN_PUBLIC_LANGUAGE.some((pattern) => pattern.test(publicText))) {
    blockers.push("forbidden_public_language");
  }

  const coverage: PersonalMythAnswerKey[] = [];
  for (const key of ANSWER_KEYS) {
    const echoes = result.answer_echoes.filter((entry) => entry.answer_key === key);
    if (
      echoes.length === 1 &&
      echoes[0].source_phrase.length >= 3 &&
      echoes[0].story_image.length >= 8 &&
      phraseBelongsToAnswer(echoes[0].source_phrase, answers[key])
    ) {
      coverage.push(key);
    }
  }
  if (coverage.length !== ANSWER_KEYS.length) blockers.push("answer_coverage_incomplete");
  if (new Set(result.answer_echoes.map((entry) => entry.answer_key)).size !== ANSWER_KEYS.length) {
    blockers.push("answer_echo_contract");
  }

  return {
    passed: blockers.length === 0,
    blockers: [...new Set(blockers)],
    word_count: wordCount,
    answer_coverage: coverage,
  };
}

export function buildPersonalMythPrompt(
  request: PersonalMythRequest,
  repairBlockers: string[] = [],
): string {
  const repairInstruction = repairBlockers.length
    ? `\nПредыдущая версия не прошла проверку: ${repairBlockers.join(", ")}. Перепиши историю полностью и исправь эти причины.`
    : "";
  return `Ты создаёшь «Личный миф» — взрослую литературную историю для саморефлексии.
Рассказчик — тихий наблюдатель, не психолог, не наставник и не пророк.
История должна быть конкретной, чувственной и ясной. Образы работают через действие, пространство, свет, звук и материальные детали, а не через абстрактную псевдоглубину.

Ответы человека:
q1 — что требует внимания: ${request.answers.q1}
q2 — образ состояния: ${request.answers.q2}
q3 — момент живости: ${request.answers.q3}
q4 — недостающее качество: ${request.answers.q4}

Требования:
- верни ровно три части истории, каждая по 130–220 русских слов;
- часть 1: мир героя, нарушение равновесия и образ состояния;
- часть 2: попытка действовать, встреча или наблюдение, момент узнавания;
- часть 3: изменение взгляда, один реальный шаг и открытый финал;
- внутри частей делай короткие читаемые абзацы через двойной перенос строки;
- раскрывай движение через конкретные сцены, а не повтор мысли и не литературный наполнитель;
- каждый из четырёх ответов должен быть узнаваем в истории;
- для каждого ответа верни answer_echo: короткую дословную фразу 2–8 слов из ответа и образ, которым она стала в истории;
- один шаг должен занимать не более 15 минут и не обещать внутреннюю трансформацию;
- вопрос для дневника остаётся открытым;
- никаких диагнозов, терапии, гипноза, лечения, исцеления, предсказаний, магии, морализаторства и «всё будет хорошо»;
- не объясняй символы как единственно правильные.
${repairInstruction}

Верни только JSON:
{
  "title": "...",
  "story_parts": [
    "часть 1, 130–220 слов",
    "часть 2, 130–220 слов",
    "часть 3, 130–220 слов"
  ],
  "mirror": {
    "mainImage": "...",
    "innerTension": "...",
    "hiddenResource": "...",
    "newView": "..."
  },
  "answer_echoes": [
    {"answer_key":"q1","source_phrase":"...","story_image":"..."},
    {"answer_key":"q2","source_phrase":"...","story_image":"..."},
    {"answer_key":"q3","source_phrase":"...","story_image":"..."},
    {"answer_key":"q4","source_phrase":"...","story_image":"..."}
  ],
  "one_step": "...",
  "journal_question": "...",
  "visual_key": "threshold|forest_path|quiet_room|river_crossing|night_window|open_field",
  "disclaimer": "Образный формат для саморефлексии. Не диагностика и не инструкция к действию."
}`;
}

function groundAnswerEchoes(
  result: PersonalMythResult,
  answers: PersonalMythAnswers,
): PersonalMythResult {
  const answerEchoes = result.answer_echoes.map((echo) => {
    if (phraseBelongsToAnswer(echo.source_phrase, answers[echo.answer_key])) return echo;
    return {
      ...echo,
      source_phrase: cleanText(answers[echo.answer_key]).split(" ").slice(0, 8).join(" "),
    };
  });
  return { ...result, answer_echoes: answerEchoes };
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

class DeepSeekPersonalMythProvider implements PersonalMythProvider {
  readonly name = "deepseek" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(env: NodeJS.ProcessEnv) {
    this.apiKey = cleanText(env.DEEPSEEK_API_KEY);
    this.model = cleanText(env.PERSONAL_MYTH_MODEL);
    this.baseUrl = cleanText(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/u, "");
  }

  isReady(): boolean {
    return this.apiKey.length >= 20 && this.model.length >= 3;
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
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "Возвращай только валидный JSON без markdown." },
            { role: "user", content: prompt },
          ],
          temperature: 0.72,
          max_tokens: 5_000,
          response_format: { type: "json_object" },
        }),
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

class GeminiPersonalMythProvider implements PersonalMythProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(env: NodeJS.ProcessEnv) {
    this.apiKey = cleanText(env.GEMINI_API_KEY);
    this.model = cleanText(env.PERSONAL_MYTH_MODEL);
  }

  isReady(): boolean {
    return this.apiKey.length >= 20 && this.model.length >= 3 && !this.model.includes("preview");
  }

  async generate(prompt: string, timeoutMs: number): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const generation = ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { temperature: 0.72, responseMimeType: "application/json" },
    });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("provider_timeout")), timeoutMs);
    });
    const response = await Promise.race([generation, timeout]);
    const content = response.text;
    if (!content?.trim()) throw new Error("provider_empty_output");
    return content;
  }
}

export function createPersonalMythProvider(env: NodeJS.ProcessEnv): PersonalMythProvider {
  const provider = cleanText(env.PERSONAL_MYTH_PROVIDER || "deepseek").toLowerCase();
  if (provider === "gemini") return new GeminiPersonalMythProvider(env);
  if (provider === "deepseek") return new DeepSeekPersonalMythProvider(env);
  throw new Error("personal_myth_provider_unsupported");
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
      const result = groundAnswerEchoes(parsePersonalMythResult(raw), request.answers);
      const quality = validatePersonalMythResult(result, request.answers);
      if (quality.passed) return { result, quality, repaired: attempt === 1 };
      lastQuality = quality;
      blockers = quality.blockers.map((blocker) =>
        blocker === "story_word_count"
          ? `${blocker} (фактически ${quality.word_count} слов, требуется 280–700)`
          : blocker,
      );
    } catch (error) {
      blockers = [error instanceof Error ? error.message : "result_parse_failed"];
    }
  }
  const finalBlockers = blockers.join("|");
  const metrics = lastQuality ? `;word_count=${lastQuality.word_count}` : "";
  throw new Error(`personal_myth_quality_failed:${finalBlockers}${metrics}`);
}
