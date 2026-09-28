import crypto from "crypto";
import { PRIMARY_MODEL } from "./routerai";
import { machineClaim, meetingEvidence, mergeTruthEvidence, type TruthState } from "./truthEvidence";
import { checkCrisisAndHazardousAction, CRISIS_SAFE_MESSAGE, type CrisisCheckResult } from "./safety";
import type {
  AlbertOpenerActionType,
  ApiResponse,
  CalculationResult,
  CodeV2Payload,
  MeetingDivergence,
  MeetingParallel,
  StoryInputs,
} from "../src/types";

export const ALBERT_CRISIS_SAFE_MESSAGE =
  "Сейчас важнее всего ваша безопасность. Пожалуйста, обратитесь за живой поддержкой: 112 (экстренная служба) или 8-800-2000-122 (бесплатная горячая линия психологической помощи).";

export interface AlbertDialogueContext {
  userQuestion?: string;
  userNote?: string;
  meetingSummary?: string;
  confidenceNote?: string;
  centralQuestion?: string;
  albertInsight?: string;
  soulNumber?: number;
  mainPattern?: string;
  codeDate?: string;
  codeCalculation?: CalculationResult | null;
  codeV2Payload?: Partial<CodeV2Payload> | null;
  codeReactions?: Record<string, "confirmed" | "rejected">;
  storyInputs?: StoryInputs | null;
  storyResult?: NonNullable<ApiResponse["story_result"]> | null;
  parallels?: MeetingParallel[];
  resonances?: Array<{
    theme: string;
    codeAnchor?: string;
    mythAnchor?: string;
    synthesis?: string;
  }>;
  divergences?: Array<{
    theme: string;
    codeAspect?: string;
    mythAspect?: string;
    reflection?: string;
  }>;
  reflectiveQuestion?: string;
  codeAnchors?: {
    numbers?: { soul?: number; path?: number; direction?: number; expression?: number; result?: number };
    keyInsight?: string;
    mainPattern?: string;
    strength?: string;
    tension?: string;
  };
  mythAnchors?: {
    title?: string;
    mainImage?: string;
    innerTension?: string;
    hiddenResource?: string;
    newView?: string;
    oneStep?: string;
  };
}

export interface AlbertDialogueRequest {
  message?: string;
  actionType?: AlbertOpenerActionType;
  sourceStateVersion?: string;
  history?: Array<{ sender: "user" | "albert"; text: string }>;
  context?: AlbertDialogueContext;
  truthState?: TruthState;
}

export interface AlbertDialogueResponse {
  status: "ok" | "crisis";
  message: string;
  response: string;
  provider: string;
  model: string | null;
  authority: "digital-code-system/telegram_v2.albert.orchestrator";
  actionType?: AlbertOpenerActionType;
  sourceStateVersion?: string;
  next_open_loop?: string | null;
  nextOpenLoop?: string | null;
  safetyState?: string;
  isCrisis?: boolean;
  suppressCommercialOffer?: boolean;
  grounding_state?: string;
  truthState?: TruthState;
}

export class AlbertCanonicalError extends Error {
  public readonly canonical_status: number | null;
  public readonly canonical_error: string;
  public readonly provider_outcome: string | null;

  constructor(
    public readonly downstreamStatus: number | null,
    public readonly downstreamCode: string,
    public readonly requestId: string,
    options?: {
      providerOutcome?: string | null;
    },
  ) {
    super("albert_canonical_failed");
    this.canonical_status = downstreamStatus;
    this.canonical_error = downstreamCode;
    this.provider_outcome = options?.providerOutcome ?? null;
  }
}

function safeCode(value: unknown): string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value)
    ? value : "unclassified_error";
}

/**
 * Санитизация видимого текста Альберта и промежуточных подписей от технических имён полей и схем.
 */
export function sanitizeVisibleAlbertText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\bmainPattern\b/gi, "центральный мотив")
    .replace(/\bmain_pattern\b/gi, "центральный мотив")
    .replace(/\bq[1-4]\b/gi, "ответ в мифе")
    .replace(/\bcodeAnchors?\b/gi, "опора в коде")
    .replace(/\bmythAnchors?\b/gi, "образ мифа")
    .replace(/\balbertInsight\b/gi, "наблюдение")
    .replace(/\binnerTension\b/gi, "внутреннее напряжение")
    .replace(/\bhiddenResource\b/gi, "скрытая опора")
    .replace(/\bnewView\b/gi, "новый взгляд")
    .replace(/\bmainImage\b/gi, "центральный образ");
}

/**
 * Проверяет входящее сообщение, вопрос пользователя и ответы Личного мифа (q1–q4)
 * на кризисные маркеры ДО обращения к DCS.
 */
export function checkSafety(input: unknown): CrisisCheckResult {
  const combinedSafeMessage = `${ALBERT_CRISIS_SAFE_MESSAGE}\n\n${CRISIS_SAFE_MESSAGE}`;

  if (typeof input === "string") {
    const res = checkCrisisAndHazardousAction(input);
    return {
      isCrisis: res.isCrisis,
      safeMessage: combinedSafeMessage,
    };
  }

  if (input && typeof input === "object") {
    const obj = input as Record<string, any>;
    const candidates: unknown[] = [];

    if (typeof obj.message === "string" && obj.message.trim()) {
      candidates.push(obj.message);
    }
    if (typeof obj.userQuestion === "string" && obj.userQuestion.trim()) {
      candidates.push(obj.userQuestion);
    }
    if (obj.storyInputs && typeof obj.storyInputs === "object") {
      candidates.push(obj.storyInputs);
    }
    if (obj.context && typeof obj.context === "object") {
      if (typeof obj.context.userQuestion === "string" && obj.context.userQuestion.trim()) {
        candidates.push(obj.context.userQuestion);
      }
      if (obj.context.storyInputs && typeof obj.context.storyInputs === "object") {
        candidates.push(obj.context.storyInputs);
      }
    }
    if (
      typeof obj.q1 === "string" ||
      typeof obj.q2 === "string" ||
      typeof obj.q3 === "string" ||
      typeof obj.q4 === "string"
    ) {
      candidates.push(obj);
    }

    for (const candidate of candidates) {
      const check = checkCrisisAndHazardousAction(candidate);
      if (check.isCrisis) {
        return {
          isCrisis: true,
          safeMessage: combinedSafeMessage,
        };
      }
    }
  }

  return {
    isCrisis: false,
    safeMessage: combinedSafeMessage,
  };
}

function toDeclarativeStatement(raw: string, maxLen = 280): string {
  const cleaned = sanitizeVisibleAlbertText(raw)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\?+$/g, ".");
  if (!cleaned) return "";
  return cleaned.slice(0, maxLen);
}

function isQuestionLike(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes("?")) return true;
  return /^(что|как|почему|зачем|когда|где|кто|какой|какая|какие|какое|куда|откуда|стоит ли|могу ли|можно ли)\b/i.test(
    trimmed
  );
}

function hasMythInContext(context?: AlbertDialogueContext): boolean {
  if (!context) return false;
  const m = context.mythAnchors || context.storyResult?.mirror;
  const title = context.mythAnchors?.title || context.storyResult?.title;
  const si = context.storyInputs;
  return Boolean(
    title?.trim() ||
      m?.mainImage?.trim() ||
      m?.innerTension?.trim() ||
      m?.hiddenResource?.trim() ||
      m?.newView?.trim() ||
      si?.q1?.trim() ||
      si?.q2?.trim() ||
      si?.q3?.trim() ||
      si?.q4?.trim()
  );
}

export function buildShortJuxtapositionOpenerPrompt(context?: AlbertDialogueContext): string {
  if (hasMythInContext(context)) {
    return "Что доступные результаты Кода и Личного мифа значат для моего вопроса? Ответь предельно сжато в трёх коротких абзацах (по одному-два предложения в каждом абзаце, без записи новых числительных цифрами): первое — одно конкретное схождение или расхождение с понятным основанием (а если содержательной связи между ними не видно, честно признай это без натяжки), строго разделяя вычисленные числа, мои собственные слова и художественную сцену Мифа и сохраняя модальность «как будто», если она есть во вводных; второе — возможный смысл для моей текущей ситуации в форме осторожной гипотезы без придумывания скрытого конфликта; третье — какой один короткий вопрос в самом конце позволит мне уточнить или отвергнуть эту гипотезу?";
  }
  return "Что доступный результат Цифрового Кода значит для моего вопроса? Ответь предельно сжато в трёх коротких абзацах (по одному-два предложения в каждом абзаце, без записи новых числительных цифрами): первое — как ключевая линия Кода соотносится с моим вопросом (или честно признай, если прямой связи не видно), строго разделяя вычисленные числа и гипотезу интерпретации; второе — возможный смысл для моей текущей ситуации в форме осторожной гипотезы; третье — какой один короткий вопрос в самом конце позволит мне уточнить или отвергнуть эту гипотезу?";
}

/**
 * Builds canonical SharedContextEnvelopeV1 from Web Albert context.
 * Strict adherence to DCS context schema without leaking internal field names.
 */
export function buildCanonicalEnvelopeFromWebContext(
  context?: AlbertDialogueContext,
  history?: Array<{ sender: "user" | "albert"; text: string }>
): Record<string, any> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
  const userRef = crypto.randomUUID();

  const c =
    context?.codeAnchors?.numbers ||
    context?.codeCalculation ||
    (context as any)?.codeV2Payload?.calculation?.five_numbers ||
    (context as any)?.codeV2Payload?.calculation?.canonical_result ||
    (typeof context?.soulNumber === "number" ? { soul: context.soulNumber } : {});

  const components = [
    ["mind", c.soul],
    ["path", c.path],
    ["direction", c.direction],
    ["expression", c.expression],
    ["result", c.result],
  ]
    .filter(([, value]) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9)
    .map(([key, value]) => ({ component_key: key, value_summary: String(value) }));

  const mythTitle = sanitizeVisibleAlbertText(
    (context?.mythAnchors?.title || context?.storyResult?.title || "").trim()
  );
  const mythMainImage = sanitizeVisibleAlbertText(
    (context?.mythAnchors?.mainImage || context?.storyResult?.mirror?.mainImage || "").trim()
  );
  const mythInnerTension = sanitizeVisibleAlbertText(
    (context?.mythAnchors?.innerTension || context?.storyResult?.mirror?.innerTension || "").trim()
  );
  const mythHiddenResource = sanitizeVisibleAlbertText(
    (context?.mythAnchors?.hiddenResource || context?.storyResult?.mirror?.hiddenResource || "").trim()
  );
  const mythNewView = sanitizeVisibleAlbertText(
    (context?.mythAnchors?.newView || context?.storyResult?.mirror?.newView || "").trim()
  );

  const rawResonances = context?.resonances || context?.parallels || [];
  const sanitizedResonances = rawResonances.map((r) => ({
    theme: sanitizeVisibleAlbertText(r.theme || ""),
    codeAnchor: sanitizeVisibleAlbertText(r.codeAnchor || ""),
    mythAnchor: sanitizeVisibleAlbertText(r.mythAnchor || ""),
    synthesis: sanitizeVisibleAlbertText(r.synthesis || ""),
  }));

  const rawDivergences = context?.divergences || [];
  const sanitizedDivergences = rawDivergences.map((d) => ({
    theme: sanitizeVisibleAlbertText(d.theme || ""),
    codeAspect: sanitizeVisibleAlbertText(d.codeAspect || ""),
    mythAspect: sanitizeVisibleAlbertText(d.mythAspect || ""),
    reflection: sanitizeVisibleAlbertText(d.reflection || ""),
  }));

  const explicitMeetingSummary = sanitizeVisibleAlbertText((context?.meetingSummary || "").trim());

  const evidence = meetingEvidence(
    explicitMeetingSummary,
    mythMainImage,
    sanitizedResonances,
    sanitizedDivergences,
    now
  );

  // Add all remaining facets of the Personal Myth mirror with explicit source: "myth"
  if (mythTitle) {
    evidence.push(machineClaim(`Название мифа: ${mythTitle.slice(0, 400)}`, "myth", "myth.title", now));
  }
  if (mythInnerTension) {
    evidence.push(
      machineClaim(`Внутреннее напряжение в мифе: ${mythInnerTension.slice(0, 600)}`, "myth", "myth.innerTension", now)
    );
  }
  if (mythHiddenResource) {
    evidence.push(
      machineClaim(`Скрытая опора в мифе: ${mythHiddenResource.slice(0, 600)}`, "myth", "myth.hiddenResource", now)
    );
  }
  if (mythNewView) {
    evidence.push(
      machineClaim(`Новый взгляд в мифе: ${mythNewView.slice(0, 600)}`, "myth", "myth.newView", now)
    );
  }

  // Memory statements from history and explicit user question / note
  const trimmedUserQuestion =
    typeof context?.userQuestion === "string"
      ? sanitizeVisibleAlbertText(context.userQuestion.trim()).slice(0, 500)
      : "";
  if (trimmedUserQuestion) {
    evidence.push(machineClaim(`Мой вопрос: ${trimmedUserQuestion}`, "user_statement", "user.question", now));
  }

  // Collect user's own answers from storyInputs in human language (NEVER using q1-q4 labels)
  const storyInputs = context?.storyInputs;
  const storyInputStatements: string[] = [];
  const storyTurnSegments: string[] = [];

  if (storyInputs && typeof storyInputs === "object") {
    const spaceAns = typeof storyInputs.q1 === "string" ? sanitizeVisibleAlbertText(storyInputs.q1.trim()) : "";
    const tensionAns = typeof storyInputs.q2 === "string" ? sanitizeVisibleAlbertText(storyInputs.q2.trim()) : "";
    const resourceAns = typeof storyInputs.q3 === "string" ? sanitizeVisibleAlbertText(storyInputs.q3.trim()) : "";
    const viewAns = typeof storyInputs.q4 === "string" ? sanitizeVisibleAlbertText(storyInputs.q4.trim()) : "";

    if (spaceAns) {
      storyTurnSegments.push(`Пространство — ${spaceAns}`);
      const stmt = toDeclarativeStatement(`Пространство в моём ответе: ${spaceAns}`, 280);
      if (stmt) storyInputStatements.push(stmt);
    }
    if (tensionAns) {
      storyTurnSegments.push(`Заминка или трещина — ${tensionAns}`);
      const stmt = toDeclarativeStatement(`Образ состояния в моём ответе: ${tensionAns}`, 280);
      if (stmt) storyInputStatements.push(stmt);
    }
    if (resourceAns) {
      storyTurnSegments.push(`Опора — ${resourceAns}`);
      const stmt = toDeclarativeStatement(`Опора и точка живости в моём ответе: ${resourceAns}`, 280);
      if (stmt) storyInputStatements.push(stmt);
    }
    if (viewAns) {
      storyTurnSegments.push(`Изменение взгляда — ${viewAns}`);
      const stmt = toDeclarativeStatement(`Искомое качество и изменение взгляда: ${viewAns}`, 280);
      if (stmt) storyInputStatements.push(stmt);
    }
  }

  const combinedStoryTurnText =
    storyTurnSegments.length > 0
      ? `Мои ответы в Личном мифе: ${storyTurnSegments.join(". ")}.`
      : "";

  if (combinedStoryTurnText) {
    evidence.push(
      machineClaim(combinedStoryTurnText.slice(0, 1000), "user_statement", "user.story_inputs", now)
    );
  }

  const v2 = (context as any)?.codeV2Payload;
  const rawReactions = (context as any)?.codeReactions;
  const reactions: Record<string, "confirmed" | "rejected"> =
    rawReactions && typeof rawReactions === "object" ? rawReactions : {};

  const reactionStatements: Array<{ sender: "user"; text: string }> = [];
  const candidateHypotheses = [
    v2?.central_motif,
    v2?.synthesis?.strongest_motif,
    context?.codeAnchors?.keyInsight,
    context?.mainPattern,
    context?.codeAnchors?.mainPattern,
  ];
  const rawCodeHypothesis =
    candidateHypotheses.find((v): v is string => typeof v === "string" && v.trim().length > 0) || "";
  const codeHypothesis = sanitizeVisibleAlbertText(rawCodeHypothesis.trim());

  if (codeHypothesis) {
    const snippet = codeHypothesis.slice(0, 300);
    if (reactions["central_motif"] === "rejected") {
      const msg = `Отмечено «Не похоже» (центральная гипотеза карты не совпадает с моим опытом): ${snippet}`;
      evidence.push(machineClaim(msg, "user_statement", "user.reaction.central_motif", now));
      reactionStatements.push({ sender: "user", text: msg });
    } else {
      evidence.push(machineClaim(codeHypothesis.slice(0, 2000), "code_interpretation", "code.central_motif", now));
      if (reactions["central_motif"] === "confirmed") {
        reactionStatements.push({ sender: "user", text: `Отмечено «Похоже» по центральной гипотезе карты: ${snippet}` });
      }
    }
  }

  if (Array.isArray(v2?.positions)) {
    for (const pos of v2.positions.slice(0, 5)) {
      if (pos && typeof pos.public_name === "string" && typeof pos.essence === "string") {
        const posKey = String(pos.position || pos.public_name);
        const cleanEssence = sanitizeVisibleAlbertText(pos.essence);
        const summaryText = `${pos.public_name} (${pos.energy}, ${pos.role || ""}): ${cleanEssence}`.slice(0, 600);
        if (reactions[posKey] === "rejected") {
          const msg = `Отмечено «Не похоже» по позиции ${pos.public_name} (${pos.energy}, ${pos.role || ""}) — не считать это фактом обо мне.`;
          evidence.push(machineClaim(msg, "user_statement", `user.reaction.${posKey}`, now));
          reactionStatements.push({ sender: "user", text: msg });
        } else {
          evidence.push(machineClaim(summaryText, "code_interpretation", `code.position.${posKey}`, now));
          if (reactions[posKey] === "confirmed") {
            reactionStatements.push({ sender: "user", text: `Отмечено «Похоже» по позиции ${pos.public_name} (${pos.energy}).` });
          }
        }
      }
    }
  }

  // Build salient_user_statements: up to 5 non-empty declarative strings <= 280 chars (no questions, no q1-q4)
  const candidateSalientStrings: string[] = [
    ...storyInputStatements,
    ...(trimmedUserQuestion && !isQuestionLike(trimmedUserQuestion)
      ? [toDeclarativeStatement(`Моя тема для разбора: ${trimmedUserQuestion}`, 280)]
      : []),
    ...reactionStatements.map((r) => toDeclarativeStatement(r.text, 280)),
    ...(context?.userNote ? [toDeclarativeStatement(context.userNote, 280)] : []),
    ...(history || [])
      .filter((h) => h.sender === "user" && typeof h.text === "string" && !isQuestionLike(h.text))
      .map((h) => toDeclarativeStatement(h.text, 280)),
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 280 && !isQuestionLike(s));

  const salientStatements = Array.from(new Set(candidateSalientStrings)).slice(0, 5);

  // Build recent_turns, prepending combined declarative story turn if not already in history
  const historyTurns = (history || [])
    .filter((h) => (h.sender === "user" || h.sender === "albert") && typeof h.text === "string" && h.text.trim())
    .slice(-8)
    .map((h) => ({
      role: h.sender === "user" ? "user" : "assistant",
      text: sanitizeVisibleAlbertText(h.text.trim()).slice(0, 2000),
    }));

  const hasStoryTurnInHistory = historyTurns.some(
    (t) => t.role === "user" && t.text.includes("Мои ответы в Личном мифе:")
  );
  const recentTurns =
    combinedStoryTurnText && !hasStoryTurnInHistory
      ? [{ role: "user", text: combinedStoryTurnText.slice(0, 2000) }, ...historyTurns].slice(-8)
      : historyTurns;

  const hasCodeLens = components.length > 0 || Boolean(codeHypothesis);
  const hasMythLens = Boolean(
    mythMainImage || mythTitle || mythInnerTension || mythHiddenResource || mythNewView || combinedStoryTurnText
  );

  const effectiveMeetingSummary = explicitMeetingSummary ? explicitMeetingSummary.slice(0, 500) : null;

  const systemQuestion = sanitizeVisibleAlbertText(
    context?.centralQuestion ||
      context?.reflectiveQuestion ||
      v2?.albert_context?.opening_question ||
      "Что из увиденного вы хотели бы проверить на своём опыте?"
  );
  const currentQuestion = trimmedUserQuestion || systemQuestion;
  const nextOpenLoop = systemQuestion;

  return {
    schema_version: "telegram_v2.context.v1",
    user_ref: userRef,
    consent: {
      core_state: true,
      cross_surface: true,
      proactive_messages: false,
      recorded_at: now,
      policy_version: "u1-consent.v1",
    },
    retention: {
      retention_class: "standard",
      expires_at: expiresAt,
      policy_marker: "7d_retention_bound",
    },
    derived_code: components.length
      ? {
          method_version: v2 ? "interpretation_v2" : "v1",
          profile_ref: `code_${components.map((comp) => comp.value_summary).join("_")}`,
          components,
          generated_at: now,
        }
      : null,
    evidence,
    experience_state: {
      myth_summary: (mythMainImage || mythTitle || "").slice(0, 300) || null,
      meeting_summary: effectiveMeetingSummary,
      updated_at: now,
    },
    active_thread: {
      current_question: currentQuestion.slice(0, 300),
      opened_at: now,
      next_open_loop: nextOpenLoop.slice(0, 300),
      topic_summary: sanitizeVisibleAlbertText(
        trimmedUserQuestion ||
          context?.albertInsight ||
          v2?.albert_context?.strongest_hypothesis ||
          "Исследование своего опыта"
      ).slice(0, 100),
    },
    memory_summary: {
      summary: (
        explicitMeetingSummary ||
        (hasCodeLens && hasMythLens
          ? "Доступны результаты Цифрового Кода и Личного мифа для сопоставления вокруг вопроса человека."
          : codeHypothesis
          ? "Открыта символическая карта Кода; её гипотезы ещё предстоит проверить."
          : "Начат разговор о личном опыте.")
      ).slice(0, 300),
      salient_user_statements: salientStatements,
      recent_turns: recentTurns,
      updated_at: now,
    },
  };
}

/**
 * Pure DTO/transport adapter: delegating completely to canonical DCS Albert orchestrator.
 * Authority: digital-code-system/telegram_v2.albert.orchestrator
 */
export const ALBERT_MESSAGE_MAX_LENGTH = 2000;

export function parseAlbertMessage(request: {
  message?: unknown;
  actionType?: unknown;
  context?: AlbertDialogueContext;
}): string {
  if (request?.actionType === "short_juxtaposition_opener") {
    return buildShortJuxtapositionOpenerPrompt(request.context);
  }
  const userText = String(request?.message || "").trim();
  if (!userText || userText.length > ALBERT_MESSAGE_MAX_LENGTH) {
    throw new Error("invalid_message");
  }
  return userText;
}

export async function generateAlbertDialogue(
  request: AlbertDialogueRequest,
  _client?: any,
  model: string = PRIMARY_MODEL,
  timeoutMs: number = 45_000,
  consentReceipt?: { version: string; recordedAt: number }
): Promise<AlbertDialogueResponse> {
  const actionType: AlbertOpenerActionType =
    request?.actionType === "short_juxtaposition_opener" ? "short_juxtaposition_opener" : "user_message";
  const sourceStateVersion =
    typeof request?.sourceStateVersion === "string" ? request.sourceStateVersion : undefined;

  // Crisis interception strictly BEFORE calling DCS
  const safetyResult = checkSafety(request);
  if (safetyResult.isCrisis) {
    const safeResponseText =
      safetyResult.safeMessage || ALBERT_CRISIS_SAFE_MESSAGE;
    return {
      status: "crisis",
      isCrisis: true,
      response: safeResponseText,
      message: safeResponseText,
      suppressCommercialOffer: true,
      safetyState: "crisis",
      actionType,
      sourceStateVersion,
      nextOpenLoop: null,
      next_open_loop: null,
      provider: "safety_guard",
      model: null,
      authority: "digital-code-system/telegram_v2.albert.orchestrator",
    };
  }

  const userText = parseAlbertMessage(request);

  const envelope = buildCanonicalEnvelopeFromWebContext(request.context, request.history);
  if (consentReceipt) {
    envelope.consent.recorded_at = new Date(consentReceipt.recordedAt).toISOString();
    envelope.consent.policy_version = consentReceipt.version;
    envelope.consent.cross_surface = false;
  }
  envelope.evidence = mergeTruthEvidence(envelope.evidence, request.truthState);
  const dcsUrl = process.env.DCS_BRIDGE_URL || "http://127.0.0.1:39500";
  const requestId = `web_albert_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  console.info(`[Albert Web Adapter] Calling canonical DCS Albert orchestrator request_id=${requestId}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${dcsUrl}/api/canonical/albert/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: requestId,
        user_message: userText,
        envelope,
        turn_intent: "continuation",
        model,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const downstreamCode = safeCode(errBody?.error);
      const lastErrEvent =
        Array.isArray(errBody?.provider_events) && errBody.provider_events.length > 0
          ? errBody.provider_events[errBody.provider_events.length - 1]
          : null;
      const providerOutcome =
        typeof errBody?.provider_outcome === "string"
          ? safeCode(errBody.provider_outcome)
          : typeof lastErrEvent?.outcome === "string"
          ? safeCode(lastErrEvent.outcome)
          : null;
      console.error("[Albert Web Adapter] canonical_failure", {
        status: resp.status,
        error: downstreamCode,
        provider_outcome: providerOutcome,
        request_id: requestId,
      });
      throw new AlbertCanonicalError(resp.status, downstreamCode, requestId, {
        providerOutcome,
      });
    }

    const data = (await resp.json()) as any;
    if (data.safety_state === "deferred") {
      const lastEvent =
        Array.isArray(data.provider_events) && data.provider_events.length > 0
          ? data.provider_events[data.provider_events.length - 1]
          : null;
      const providerOutcome = typeof lastEvent?.outcome === "string" ? safeCode(lastEvent.outcome) : "deferred";
      console.error("[Albert Web Adapter] canonical_deferred", {
        status: resp.status,
        error: "safety_state_deferred",
        provider_outcome: providerOutcome,
        request_id: requestId,
      });
      throw new AlbertCanonicalError(resp.status, "safety_state_deferred", requestId, {
        providerOutcome,
      });
    }

    if (data.safety_state === "crisis" || data.status === "crisis") {
      const crisisReply = sanitizeVisibleAlbertText(
        data.text || data.turn?.reply_text || data.reply_text || ALBERT_CRISIS_SAFE_MESSAGE
      );
      return {
        status: "crisis",
        isCrisis: true,
        response: crisisReply,
        message: crisisReply,
        suppressCommercialOffer: true,
        safetyState: "crisis",
        actionType,
        sourceStateVersion,
        nextOpenLoop: null,
        next_open_loop: null,
        provider: data.provider || "safety_guard",
        model: data.model ?? null,
        authority: "digital-code-system/telegram_v2.albert.orchestrator",
      };
    }

    const rawReplyText = data.text || data.turn?.reply_text || data.reply_text;
    if (data.status !== "ok" || !rawReplyText) {
      console.error("[Albert Web Adapter] canonical_empty_reply", { request_id: requestId });
      throw new AlbertCanonicalError(resp.status, "empty_reply", requestId);
    }

    const replyText = sanitizeVisibleAlbertText(String(rawReplyText));
    const nextOpenLoop =
      typeof data.next_open_loop === "string" ? sanitizeVisibleAlbertText(data.next_open_loop) : null;
    const safetyState = typeof data.safety_state === "string" ? data.safety_state : "nominal";

    return {
      status: "ok",
      message: replyText,
      response: replyText,
      provider: data.provider || "unknown",
      model: data.model ?? null,
      authority: "digital-code-system/telegram_v2.albert.orchestrator",
      actionType,
      sourceStateVersion,
      next_open_loop: nextOpenLoop,
      nextOpenLoop,
      safetyState,
      ...(safetyState === "crisis" ? { isCrisis: true, suppressCommercialOffer: true } : {}),
      grounding_state: data.grounding_state || data.turn?.grounding_state || "grounded",
      truthState: data.evidence_delta
        ? {
            evidence: data.evidence_delta,
            expiresAt:
              request.truthState?.expiresAt && Date.parse(request.truthState.expiresAt) > Date.now()
                ? new Date(
                    Math.min(Date.parse(request.truthState.expiresAt), Date.parse(envelope.retention.expires_at))
                  ).toISOString()
                : envelope.retention.expires_at,
          }
        : undefined,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      console.error("[Albert Web Adapter] canonical_timeout", { request_id: requestId });
      throw new AlbertCanonicalError(null, "timeout", requestId, {
        providerOutcome: "timeout",
      });
    }
    if (err instanceof AlbertCanonicalError) throw err;
    console.error("[Albert Web Adapter] canonical_transport_failure", { request_id: requestId });
    throw new AlbertCanonicalError(null, "transport_failure", requestId, {
      providerOutcome: "transport_failure",
    });
  }
}

