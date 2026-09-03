import crypto from "crypto";

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
}

export interface AlbertDialogueResponse {
  status: "ok";
  message: string;
  provider: "deepseek";
  model: string;
  authority: "digital-code-system/telegram_v2.albert.orchestrator";
  next_open_loop?: string;
  grounding_state?: string;
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
    { component_key: "mind", value_summary: String(c.soul ?? 7) },
    { component_key: "path", value_summary: String(c.path ?? 1) },
    { component_key: "direction", value_summary: String(c.direction ?? 8) },
    { component_key: "expression", value_summary: String(c.expression ?? 9) },
    { component_key: "result", value_summary: String(c.result ?? 5) },
  ];

  const evidence: Array<{ status: string; claim_summary: string; recorded_at: string }> = [];
  if (context?.resonances) {
    for (const r of context.resonances) {
      if (r.theme) {
        evidence.push({
          status: "confirmed",
          claim_summary: `Резонанс [${r.theme}]: ${(r.synthesis || r.codeAnchor || "").slice(0, 120)}`,
          recorded_at: now,
        });
      }
    }
  }
  if (context?.divergences) {
    for (const d of context.divergences) {
      if (d.theme) {
        evidence.push({
          status: "partial",
          claim_summary: `Контраст [${d.theme}]: ${(d.reflection || d.codeAspect || "").slice(0, 120)}`,
          recorded_at: now,
        });
      }
    }
  }

  // Memory statements from history
  const salientStatements = (history || [])
    .filter((h) => h.sender === "user")
    .map((h) => h.text.trim())
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
    derived_code: {
      method_version: "v1",
      profile_ref: `code_${c.soul ?? 7}_${c.path ?? 1}_${c.result ?? 5}`,
      components,
      generated_at: now,
    },
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
  model: string = "deepseek-v4-pro",
  timeoutMs: number = 45_000
): Promise<AlbertDialogueResponse> {
  const userText = String(request.message || "").trim();
  if (!userText || userText.length > 2000) {
    throw new Error("invalid_message");
  }

  const envelope = buildCanonicalEnvelopeFromWebContext(request.context, request.history);
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
      provider: "deepseek",
      model,
      authority: "digital-code-system/telegram_v2.albert.orchestrator",
      next_open_loop: data.next_open_loop || request.context?.centralQuestion || "В чем ваша главная опора сейчас?",
      grounding_state: data.grounding_state || data.turn?.grounding_state || "grounded",
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError" || (err.message && err.message.includes("abort"))) {
      throw new Error("albert_timeout:request_deadline_exhausted");
    }
    throw err;
  }
}
