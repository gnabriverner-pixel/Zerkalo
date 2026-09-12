import crypto from "crypto";
import { PRIMARY_MODEL } from './routerai';
import { meetingEvidence, mergeTruthEvidence, type TruthState } from "./truthEvidence";

export interface AlbertDialogueContext {
  meetingSummary?: string;
  confidenceNote?: string;
  centralQuestion?: string;
  albertInsight?: string;
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
  message: string;
  history?: Array<{ sender: "user" | "albert"; text: string }>;
  context?: AlbertDialogueContext;
  truthState?: TruthState;
}

export interface AlbertDialogueResponse {
  status: "ok";
  message: string;
  provider: string;
  model: string | null;
  authority: "digital-code-system/telegram_v2.albert.orchestrator";
  next_open_loop?: string | null;
  grounding_state?: string;
  truthState?: TruthState;
}

/**
 * Builds canonical SharedContextEnvelopeV1 from Web Albert context.
 * Strict adherence to DCS context schema.
 */
export function buildCanonicalEnvelopeFromWebContext(
  context?: AlbertDialogueContext,
  history?: Array<{ sender: "user" | "albert"; text: string }>
): Record<string, any> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
  const userRef = crypto.randomUUID();

  const c = context?.codeAnchors?.numbers || {};
  const components = [
    ["mind", c.soul], ["path", c.path], ["direction", c.direction],
    ["expression", c.expression], ["result", c.result],
  ].filter(([, value]) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9)
    .map(([key, value]) => ({ component_key: key, value_summary: String(value) }));
  const evidence = meetingEvidence(context?.meetingSummary || "", context?.mythAnchors?.mainImage || "",
    context?.resonances || [], context?.divergences || [], now);

  // Memory statements from history
  const salientStatements = (history || [])
    .filter((h) => h.sender === "user")
    .map((h) => h.text.trim().slice(0, 2000))
    .filter(Boolean)
    .slice(-3);

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
    derived_code: components.length ? {
      method_version: "v1",
      profile_ref: `code_${components.map(c => c.value_summary).join("_")}`,
      components,
      generated_at: now,
    } : null,
    evidence,
    experience_state: {
      myth_summary: (context?.mythAnchors?.mainImage || context?.mythAnchors?.title || "Символический миф").slice(0, 300),
      meeting_summary: (context?.meetingSummary || "Встреча зеркал").slice(0, 500),
      updated_at: now,
    },
    active_thread: {
      current_question: (context?.centralQuestion || "В чем ваша главная опора сейчас?").slice(0, 300),
      opened_at: now,
      next_open_loop: (context?.centralQuestion || "В чем ваша главная опора сейчас?").slice(0, 300),
      topic_summary: (context?.albertInsight || "Встреча зеркал: Код и Личный миф").slice(0, 100),
    },
    memory_summary: {
      summary: (context?.meetingSummary || "Завершена встреча зеркал.").slice(0, 300),
      salient_user_statements: salientStatements,
      // Same bounded conversational memory consumed by the Telegram core.
      // Assistant text remains history, never confirmed recognition evidence.
      recent_turns: (history || [])
        .filter(h => (h.sender === "user" || h.sender === "albert") && h.text.trim())
        .slice(-8)
        .map(h => ({ role: h.sender === "user" ? "user" : "assistant", text: h.text.trim().slice(0, 2000) })),
      updated_at: now,
    },
  };
}

/**
 * Pure DTO/transport adapter: delegating completely to canonical DCS Albert orchestrator.
 * Authority: digital-code-system/telegram_v2.albert.orchestrator
 */
export async function generateAlbertDialogue(
  request: AlbertDialogueRequest,
  _client?: any,
  model: string = PRIMARY_MODEL,
  timeoutMs: number = 45_000,
  consentReceipt?: {version:string;recordedAt:number}
): Promise<AlbertDialogueResponse> {
  const userText = String(request.message || "").trim();
  if (!userText || userText.length > 2000) {
    throw new Error("invalid_message");
  }

  const envelope = buildCanonicalEnvelopeFromWebContext(request.context, request.history);
  if(consentReceipt) {
    envelope.consent.recorded_at=new Date(consentReceipt.recordedAt).toISOString();
    envelope.consent.policy_version=consentReceipt.version;
    envelope.consent.cross_surface=false;
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
      console.error(`[Albert Web Adapter] DCS Albert error:`, errBody);
      throw new Error(`albert_canonical_failed:${errBody.error || resp.status}`);
    }

    const data = (await resp.json()) as any;
    const replyText = data.text || data.turn?.reply_text || data.reply_text;
    if (data.status !== "ok" || !replyText) {
      throw new Error("albert_canonical_empty_reply");
    }

    return {
      status: "ok",
      message: replyText,
      provider: data.provider || 'unknown',
      model: data.model ?? null,
      authority: "digital-code-system/telegram_v2.albert.orchestrator",
      next_open_loop: data.next_open_loop ?? null,
      grounding_state: data.grounding_state || data.turn?.grounding_state || "grounded",
      truthState: data.evidence_delta ? {
        evidence: data.evidence_delta,
        expiresAt: request.truthState?.expiresAt && Date.parse(request.truthState.expiresAt) > Date.now()
          ? new Date(Math.min(Date.parse(request.truthState.expiresAt), Date.parse(envelope.retention.expires_at))).toISOString()
          : envelope.retention.expires_at,
      } : undefined,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError" || (err.message && err.message.includes("abort"))) {
      throw new Error("albert_timeout:request_deadline_exhausted");
    }
    throw err;
  }
}
