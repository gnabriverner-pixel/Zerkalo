import type { StoryInputs } from "../src/types";

export const PERSONAL_MYTH_WRITER_VERSION = "personal-myth-v1.1-rc";

export interface PersonalMythRequest {
  request_id: string;
  consent_version: string;
  answers: StoryInputs;
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

export interface PersonalMythProvider {
  readonly name: string;
  readonly model: string;
  isReady(): boolean;
  generate(prompt: string, timeoutMs: number): Promise<string>;
}

export interface PersonalMythQualityReport {
  passed: boolean;
  blockers: string[];
  word_count: number;
  paragraph_count: number;
}

const ANSWER_KEYS: (keyof StoryInputs)[] = ["q1", "q2", "q3", "q4"];

/**
 * Forbidden public language regexes with strict word-boundary boundaries to avoid false positives (e.g. "увлечение").
 */
const FORBIDDEN_PUBLIC_LANGUAGE = [
  /терап(?:ия|евт\w*)/iu,
  /психотерап\w*/iu,
  /гипноз\w*/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])нлп(?:$|[\s.,!?;:«»"—()\[\]])/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])леч(?:ение|ению|ения|ением|ить|ит|ат|атся|ится)(?:$|[\s.,!?;:«»"—()\[\]])/iu,
  /исцел\w*/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])магическ\w*/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])карм(?:а|ы|е|у|ой|ах|ам|ами|ическ\w*)(?:$|[\s.,!?;:«»"—()\[\]])/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])вы\s+(?:точно|обязательно|должны)(?:$|[\s.,!?;:«»"—()\[\]])/iu,
  /вс[её]\s+будет\s+хорошо/iu,
];

/**
 * Checks affirmative prediction language while ignoring negative disclaimer contexts (e.g. "не является предсказанием").
 */
const AFFIRMATIVE_PREDICTION = /(?:^|[\s.,!?;:«»"—()\[\]])(?:предсказ(?:ание|ания|ывать|ывает|ать|ываю|анное)|пророчеств\w*)(?:$|[\s.,!?;:«»"—()\[\]])/iu;
const AFFIRMATIVE_DIAGNOSIS = /(?:^|[\s.,!?;:«»"—()\[\]])диагноз\w*/iu;

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
];

const SERIAL_FINGERPRINTS = [/впервые\s+за\s+долгое\s+время/iu];

const UNSUPPORTED_CERTAINTY = [
  /(?:он|она|вы)\s+(?:боится|зависит|подавляет|саботирует|избегает)(?:$|[\s,.;!?])/iu,
  /бегств\w*\s+от\s+близости/iu,
  /страх\s+разоблачения/iu,
];

/**
 * Formal address (вы/ваш) is forbidden in Personal Myth (voice contract is second-person singular ты/твой).
 */
const FORMAL_YOU_PATTERNS = [
  /(?:^|[\s.,!?;:«»"—()\[\]])(?:вы|вас|вам|вами|ваш|ваша|ваше|ваши|вашего|вашей|вашему|вашим|ваших)(?:$|[\s.,!?;:«»"—()\[\]])/iu,
];

/**
 * Presence of second-person singular (ты/твой).
 */
const SECOND_PERSON_SINGULAR_PATTERN = /(?:^|[\s.,!?;:«»"—()\[\]])(?:ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоих|твоим|твоей|твоего|твоему)(?:$|[\s.,!?;:«»"—()\[\]])/iu;

/**
 * First-person narrator drift.
 */
const FIRST_PERSON_DRIFT = /(?:^|[\s.,!?;:«»"—()\[\]])(?:я\s+(?:увидел|почувствовал|понял|решил|думаю|считаю|знаю|помню|сказал)|мне\s+(?:кажется|показалось))(?:$|[\s.,!?;:«»"—()\[\]])/iu;

/**
 * Invented biography indicators.
 */
const INVENTED_BIOGRAPHY_PATTERNS = [
  /(?:^|[\s.,!?;:«»"—()\[\]])(?:в\s+детстве\s+ты|ты\s+в\s+детстве|когда\s+ты\s+был\s+маленьк\w*)/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])ты\s+(?:однажды\s+купил|всегда\s+боялся\s+потому\s+что|вырос\s+в|учился\s+на|работал\s+в)/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])когда\s+ты\s+работал/iu,
  /(?:^|[\s.,!?;:«»"—()\[\]])твой\s+(?:брак|развод|начальник|врач|психолог)/iu,
];

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * Dedicated prose cleaner for narrative text.
 * Preserves paragraph breaks (\n\n), normalizes intra-paragraph whitespace,
 * and strips excessive line breaks (3+ collapsed to 2).
 */
export function cleanProse(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Normalize newline characters
  const normalized = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Split into paragraphs by 2 or more newlines
  let paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter((p) => p.length > 0);

  // Fallback: if single line breaks were used instead of double
  if (paragraphs.length === 1 && paragraphs[0].includes("\n")) {
    const singleLines = paragraphs[0]
      .split(/\n+/)
      .map((p) => p.replace(/[ \t]+/g, " ").trim())
      .filter((p) => p.length > 0);
    if (singleLines.length >= 3 && singleLines.length <= 6) {
      paragraphs = singleLines;
    }
  }

  return paragraphs.join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePersonalMythRequest(value: unknown): PersonalMythRequest {
  if (!isRecord(value) || !isRecord(value.answers)) throw new Error("invalid_request_shape");
  const request_id = clean(value.request_id);
  if (!/^[a-zA-Z0-9_-]{12,80}$/u.test(request_id)) throw new Error("invalid_request_id");

  const answers = {} as StoryInputs;
  for (const key of ANSWER_KEYS) {
    const answer = clean(value.answers[key]);
    if (answer.length < 3 || answer.length > 1000) throw new Error(`invalid_answer:${key}`);
    answers[key] = answer;
  }
  return {
    request_id,
    consent_version: clean(value.consent_version || PERSONAL_MYTH_WRITER_VERSION),
    answers,
  };
}

export function containsCrisisLanguage(answers: StoryInputs): boolean {
  const combined = ANSWER_KEYS.map((key) => answers[key]).join(" ");
  return CRISIS_LANGUAGE.some((pattern) => pattern.test(combined));
}

export function buildPersonalMythPromptV11(
  request: PersonalMythRequest,
): string {
  return `Ты — зрелый русскоязычный писатель. Создай «Личный миф»: образную литературную историю для саморефлексии, которая помогает человеку увидеть нынешнее состояние со стороны через метафору. Это образное полотно, а не совет или психологический анализ.

Ниже — ответы пользователя в JSON (q1: напряжение, q2: образ состояния, q3: точка живости, q4: искомое качество).
<USER_ANSWERS_JSON>
${JSON.stringify(request.answers)}
</USER_ANSWERS_JSON>

Строгий художественный и этический контракт:
1. ЛИЦО ПОВЕСТВОВАНИЯ — ТОЛЬКО ВТОРОЕ ЛИЦО ЕДИНСТВЕННОГО ЧИСЛА («ты», «тебя», «твой», «твоя», «твоё»).
   - Главный герой — читатель («ты»).
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО обращение на «вы / вас / ваш».
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО смещать фокус в повествование от первого лица («я / мы») или делать главным героем третье лицо («он / она / человек / путник / герой»).
2. БЕЗ ПРИДУМАННОЙ БИОГРАФИИ:
   - Не приписывай пользователю выдуманных воспоминаний детства («в детстве ты...»), прошлых событий, поездок, покупок, профессий, семейных историй, травм, диагнозов или мотивов.
   - Метафорическая сцена разворачивается в вечном настоящем моменте или пространстве символа, а не в псевдо-биографическом прошлом.
3. СТРУКТУРА И ОБЪЕМ:
   - Объем истории: строго 300–800 слов.
   - Обязательно 3–6 законченных абзацев, разделенных двойным переносом строки (\\n\\n).
4. ИНТЕГРАЦИЯ Q4 И ИСТОЧНИКОВ:
   - Ответ q4 (искомое качество) — это живое направление, внутренний ориентир или вектор поиска, а не готовая мораль или автоматическое решение.
   - Не обесценивай и не отрицай q4 ради дешевого драматизма.
   - Новый взгляд (newView) должен соединять минимум два разных ответа.
5. ЛИТЕРАТУРНОЕ КАЧЕСТВО:
   - Язык конкретный, плотный, кинематографичный. Двигайся фактурой, светом, физическим действием и материальными деталями.
   - Избегай серийных штампов: «впервые за долгое время», «не X, а Y», ритуалов «на 5–15 минут».
   - Запрещены слова и корни: терапия, лечение (но слова вроде «увлечение» разрешены), лечить, диагноз, исцеление, исцелять, предсказание, магия, магический, карма, кармический, гипноз, нлп, фразы «всё будет хорошо», «вы точно должны».

Верни только валидный JSON без markdown:
{
  "mode": "story",
  "status": "ok",
  "writer_version": "${PERSONAL_MYTH_WRITER_VERSION}",
  "story_result": {
    "title": "точное поэтичное название",
    "story": "текст истории (300-800 слов) строго с 3-6 абзацами через \\n\\n",
    "mirror": {
      "mainImage": "центральный образ как открытая гипотеза (на ты)",
      "innerTension": "напряжение без уверенной причинной психологии (на ты)",
      "hiddenResource": "ресурс, прослеживаемый к ответам (на ты)",
      "newView": "новый взгляд, соединяющий минимум два ответа (на ты)"
    },
    "meaning": ["метафора", "точка выбора", "неразрешённый вопрос"],
    "one_step": "малое наблюдение или действие без обещания результата (на ты)",
    "journal_question": "один открытый вопрос (на ты)",
    "disclaimer": "Образный формат для саморефлексии. Не диагностика и не инструкция к действию."
  }
}`;
}

export function buildPersonalMythRepairPrompt(
  request: PersonalMythRequest,
  previousStory: string,
  previousMirror: PersonalMythResult["mirror"],
  blockers: string[],
): string {
  return `Ты — литературный редактор. Предыдущая версия «Личного мифа» содержит конкретные дефекты публикации:
НАРУШЕНИЯ:
${blockers.map((b) => `- ${b}`).join("\n")}

ИСХОДНЫЕ ОТВЕТЫ ПОЛЬЗОВАТЕЛЯ (JSON):
${JSON.stringify(request.answers)}

ПРЕДЫДУЩИЙ ТЕКСТ ИСТОРИИ:
${previousStory}

ПРЕДЫДУЩИЙ РАЗБОР ЗЕРКАЛА (JSON):
${JSON.stringify(previousMirror)}

ЗАДАЧА:
Сохрани сюжетную канву, поэтику, метафоры и удачные образы предыдущей версии.
Точечно исправь ТОЛЬКО указанные нарушения:
1. Повествование должно быть строго от второго лица («ты / тебя / твой»). Убери любое обращение на «вы».
2. Текст должен быть разбит на 3–6 реальных абзацев через \\n\\n.
3. Объем текста должен составлять строго 300–800 слов.
4. Убери выдуманные факты биографии или запрещенные слова, если они были указаны в нарушениях.
5. Не добавляй новых псевдо-биографических подробностей.

Верни только валидный JSON без markdown в том же формате с полями title, story (с \\n\\n), mirror, meaning, one_step, journal_question, disclaimer.`;
}

export function parsePersonalMythResult(raw: string): PersonalMythResult {
  const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim()) as unknown;
  if (!isRecord(parsed) || parsed.status === "error") throw new Error("result_not_ok");
  const result = isRecord(parsed.story_result) ? parsed.story_result : parsed;
  if (!isRecord(result) || !isRecord(result.mirror)) throw new Error("result_shape_invalid");
  const mirror = result.mirror;
  return {
    title: clean(result.title),
    story: cleanProse(result.story),
    mirror: {
      mainImage: clean(mirror.mainImage),
      innerTension: clean(mirror.innerTension),
      hiddenResource: clean(mirror.hiddenResource),
      newView: clean(mirror.newView),
    },
    meaning: Array.isArray(result.meaning) ? result.meaning.map(clean).filter(Boolean) : [],
    one_step: clean(result.one_step),
    journal_question: clean(result.journal_question),
    disclaimer: clean(result.disclaimer) || "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
  };
}

export function validatePersonalMythResult(result: PersonalMythResult): PersonalMythQualityReport {
  const blockers: string[] = [];
  const words = result.story.split(/\s+/u).filter(Boolean);
  const word_count = words.length;
  const paragraphs = result.story.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const paragraph_count = paragraphs.length;

  if (result.title.length < 3 || result.title.length > 120) blockers.push("title_length");
  if (word_count < 300 || word_count > 800) blockers.push("story_word_count_out_of_contract_300_to_800");
  if (paragraph_count < 3 || paragraph_count > 6) blockers.push("paragraph_count_out_of_contract_3_to_6");
  if (result.one_step.length < 10 || result.one_step.length > 500) blockers.push("one_step_contract");
  if (result.journal_question.length < 10 || result.journal_question.length > 300) blockers.push("journal_question_contract");
  if (Object.values(result.mirror).some((value) => value.length < 3)) blockers.push("mirror_contract");

  const nonDisclaimerText = [
    result.title,
    result.story,
    ...Object.values(result.mirror),
    ...result.meaning,
    result.one_step,
    result.journal_question,
  ].join(" ");

  // 1. Forbidden Language Check
  const matchedForbidden = FORBIDDEN_PUBLIC_LANGUAGE.filter((pattern) => pattern.test(nonDisclaimerText));
  if (matchedForbidden.length > 0) {
    console.warn(`[Forbidden Language Matched]:`, matchedForbidden.map((r) => r.source));
    blockers.push("forbidden_public_language");
  }

  // Check affirmative prediction (ignoring negative disclaimers like "не является предсказанием")
  const strippedNegativePred = nonDisclaimerText.replace(/не\s+(?:является\s+)?предсказ\w*/giu, "").replace(/без\s+предсказ\w*/giu, "");
  if (AFFIRMATIVE_PREDICTION.test(strippedNegativePred)) {
    blockers.push("affirmative_prediction_forbidden");
  }

  // Check affirmative diagnosis (ignoring negative disclaimers like "не является диагнозом")
  const strippedNegativeDiag = nonDisclaimerText.replace(/не\s+(?:является\s+)?диагноз\w*/giu, "").replace(/без\s+диагноз\w*/giu, "");
  if (AFFIRMATIVE_DIAGNOSIS.test(strippedNegativeDiag)) {
    blockers.push("affirmative_diagnosis_forbidden");
  }

  // 2. Narrative Register (Second-Person Singular ты/твой vs Formal вы/ваш)
  if (FORMAL_YOU_PATTERNS.some((pattern) => pattern.test(nonDisclaimerText))) {
    blockers.push("register_formal_you_forbidden");
  }

  if (!SECOND_PERSON_SINGULAR_PATTERN.test(result.story)) {
    blockers.push("missing_second_person_narrative");
  }

  if (FIRST_PERSON_DRIFT.test(result.story)) {
    blockers.push("narrative_first_person_drift");
  }

  // 3. Invented Biography check
  if (INVENTED_BIOGRAPHY_PATTERNS.some((pattern) => pattern.test(result.story))) {
    blockers.push("invented_biography_risk");
  }

  // 4. Template fingerprints
  if (SERIAL_FINGERPRINTS.some((pattern) => pattern.test(nonDisclaimerText))) {
    blockers.push("template_fingerprint");
  }

  // 5. Unsupported certainty in mirror
  const mirrorText = Object.values(result.mirror).join(" ");
  if (UNSUPPORTED_CERTAINTY.some((pattern) => pattern.test(mirrorText))) {
    blockers.push("unsupported_certainty");
  }

  return {
    passed: blockers.length === 0,
    blockers: [...new Set(blockers)],
    word_count,
    paragraph_count,
  };
}

export class DeepSeekMythProvider implements PersonalMythProvider {
  readonly name = "deepseek";
  readonly model: string;
  private readonly client: DeepSeekClient;

  constructor(env: NodeJS.ProcessEnv = process.env, client?: DeepSeekClient) {
    this.model = clean(env.PERSONAL_MYTH_MODEL || "deepseek-v4-pro");
    this.client = client ?? new DeepSeekClient(env);
  }

  isReady(): boolean {
    return this.client.isReady() && this.model.length >= 3;
  }

  async generate(prompt: string, timeoutMs: number): Promise<string> {
    return await this.client.call({
      model: this.model,
      messages: [
        { role: "system", content: "Возвращай только валидный JSON без markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.72,
      max_tokens: 5000,
      response_format: { type: "json_object" },
      timeoutMs,
    });
  }
}

import { DeepSeekClient } from "./deepseek";

export async function generatePersonalMyth(
  request: PersonalMythRequest,
  provider: PersonalMythProvider,
  timeoutMs: number,
): Promise<{ result: PersonalMythResult; quality: PersonalMythQualityReport; repaired: boolean }> {
  if (!provider.isReady()) throw new Error("personal_myth_provider_not_ready");

  // Attempt 1: Initial generation
  const initialPrompt = buildPersonalMythPromptV11(request);
  const rawInitial = await provider.generate(initialPrompt, timeoutMs);

  let initialResult: PersonalMythResult;
  try {
    initialResult = parsePersonalMythResult(rawInitial);
  } catch (parseError) {
    console.warn(`[PersonalMyth Parse Check] initial attempt failed:`, parseError);
    // Trigger repair on parse error
    const repairPrompt = buildPersonalMythRepairPrompt(request, rawInitial, {
      mainImage: "",
      innerTension: "",
      hiddenResource: "",
      newView: "",
    }, ["result_shape_invalid"]);
    const rawRepair = await provider.generate(repairPrompt, timeoutMs);
    const repairedResult = parsePersonalMythResult(rawRepair);
    const repairedQuality = validatePersonalMythResult(repairedResult);
    if (repairedQuality.passed) {
      return { result: repairedResult, quality: repairedQuality, repaired: true };
    }
    throw new Error(`personal_myth_quality_failed:${repairedQuality.blockers.join("|")}`);
  }

  const initialQuality = validatePersonalMythResult(initialResult);
  if (initialQuality.passed) {
    return { result: initialResult, quality: initialQuality, repaired: false };
  }

  console.warn(`[PersonalMyth Quality Check] initial attempt failed with blockers:`, initialQuality.blockers);

  // Attempt 2: Targeted editorial repair (exactly 1 repair)
  const repairPrompt = buildPersonalMythRepairPrompt(
    request,
    initialResult.story,
    initialResult.mirror,
    initialQuality.blockers,
  );
  const rawRepair = await provider.generate(repairPrompt, timeoutMs);

  let repairedResult: PersonalMythResult;
  try {
    repairedResult = parsePersonalMythResult(rawRepair);
  } catch (parseError) {
    console.warn(`[PersonalMyth Parse Check] repair attempt failed:`, parseError);
    throw new Error(`personal_myth_quality_failed:repair_parse_error`);
  }

  const repairQuality = validatePersonalMythResult(repairedResult);
  if (repairQuality.passed) {
    return { result: repairedResult, quality: repairQuality, repaired: true };
  }

  console.warn(`[PersonalMyth Quality Check] repair attempt failed with blockers:`, repairQuality.blockers);
  throw new Error(`personal_myth_quality_failed:${repairQuality.blockers.join("|")}`);
}

