import crypto from "crypto";
import { PRIMARY_MODEL } from './routerai';
import { machineClaim, meetingEvidence, mergeTruthEvidence, type TruthState } from "./truthEvidence";

export interface AlbertDialogueContext {
  userNote?: string;
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

  const c = context?.codeAnchors?.numbers || (context as any)?.codeV2Payload?.calculation?.five_numbers || {};
  const components = [
    ["mind", c.soul], ["path", c.path], ["direction", c.direction],
    ["expression", c.expression], ["result", c.result],
  ].filter(([, value]) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9)
    .map(([key, value]) => ({ component_key: key, value_summary: String(value) }));
  const evidence = meetingEvidence(context?.meetingSummary || "", context?.mythAnchors?.mainImage || "",
    context?.resonances || [], context?.divergences || [], now);

  // Memory statements from history
  const salientStatements = [...(context?.userNote ? [{ sender: "user", text: context.userNote }] : []), ...(history || [])]
    .filter((h) => h.sender === "user")
    .map((h) => h.text.trim().slice(0, 2000))
    .filter(Boolean)
    .slice(-3);

  const v2 = (context as any)?.codeV2Payload;
  const codeHypothesis = v2?.central_motif || v2?.synthesis?.strongest_motif || context?.codeAnchors?.keyInsight;
  if (typeof codeHypothesis === 'string' && codeHypothesis.trim()) {
    evidence.push(machineClaim(codeHypothesis.slice(0, 2000), 'code_interpretation', 'code.central_motif', now));
  }
  const question = context?.centralQuestion || v2?.albert_context?.opening_question || "Что из увиденного вы хотели бы проверить на своём опыте?";


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
      method_version: v2 ? "interpretation_v2" : "v1",
      profile_ref: `code_${components.map(c => c.value_summary).join("_")}`,
      components,
      generated_at: now,
    } : null,
    evidence,
    experience_state: {
      myth_summary: (context?.mythAnchors?.mainImage || context?.mythAnchors?.title || "").slice(0, 300) || null,
      meeting_summary: (context?.meetingSummary || "").slice(0, 500) || null,
      updated_at: now,
    },
    active_thread: {
      current_question: question.slice(0, 300),
      opened_at: now,
      next_open_loop: question.slice(0, 300),
      topic_summary: (context?.albertInsight || v2?.albert_context?.strongest_hypothesis || "Исследование своего опыта").slice(0, 100),
    },
    memory_summary: {
      summary: (context?.meetingSummary || (codeHypothesis ? "Открыта символическая карта Кода; её гипотезы ещё предстоит проверить." : "Начат разговор о личном опыте.")).slice(0, 300),
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
export const ALBERT_MESSAGE_MAX_LENGTH = 2000;

export function parseAlbertMessage(request: { message?: unknown }): string {
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
  consentReceipt?: {version:string;recordedAt:number}
): Promise<AlbertDialogueResponse> {
  const userText = parseAlbertMessage(request);

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
      const downstreamCode = safeCode(errBody?.error);
      const lastErrEvent = Array.isArray(errBody?.provider_events) && errBody.provider_events.length > 0
        ? errBody.provider_events[errBody.provider_events.length - 1]
        : null;
      const providerOutcome = typeof errBody?.provider_outcome === "string"
        ? safeCode(errBody.provider_outcome)
        : (typeof lastErrEvent?.outcome === "string" ? safeCode(lastErrEvent.outcome) : null);
      console.error("[Albert Web Adapter] canonical_failure", {
        status: resp.status, error: downstreamCode, provider_outcome: providerOutcome, request_id: requestId,
      });
      throw new AlbertCanonicalError(resp.status, downstreamCode, requestId, {
        providerOutcome,
      });
    }

    const data = (await resp.json()) as any;
    if (data.safety_state === "deferred") {
      const lastEvent = Array.isArray(data.provider_events) && data.provider_events.length > 0
        ? data.provider_events[data.provider_events.length - 1]
        : null;
      const providerOutcome = typeof lastEvent?.outcome === "string" ? safeCode(lastEvent.outcome) : "deferred";
      console.error("[Albert Web Adapter] canonical_deferred", {
        status: resp.status, error: "safety_state_deferred", provider_outcome: providerOutcome, request_id: requestId,
      });
      throw new AlbertCanonicalError(resp.status, "safety_state_deferred", requestId, {
        providerOutcome,
      });
    }

    const replyText = data.text || data.turn?.reply_text || data.reply_text;
    if (data.status !== "ok" || !replyText) {
      console.error("[Albert Web Adapter] canonical_empty_reply", { request_id: requestId });
      throw new AlbertCanonicalError(resp.status, "empty_reply", requestId);
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
