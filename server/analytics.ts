import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

export const ALLOWED_DECISION_EVENTS = [
  "landing_view",
  "journey_started",
  "myth_started",
  "myth_completed",
  "myth_feedback_submitted",
  "journey_completed",
  "return_1d",
  "return_7d",
  "share_clicked",
  "generation_failed",
  "provider_failed",
  "safety_route_triggered",
  "dropoff_stage",
  "time_to_first_value",
  "book_preview_opened",
] as const;

export type AllowedEventName = typeof ALLOWED_DECISION_EVENTS[number];

export const FORBIDDEN_ANALYTICS_KEYS = [
  "dob",
  "birth_date",
  "date_of_birth",
  "q1",
  "q2",
  "q3",
  "q4",
  "answers",
  "story",
  "story_result",
  "story_text",
  "raw_feedback",
  "feedback_text",
  "free_text",
  "name",
  "email",
  "telegram_id",
  "telegram",
  "phone",
  "ip",
  "ip_address",
  "client_ip",
  "user_note",
  "note",
];

export const ALLOWED_STATUS_CODES = [
  "ok",
  "failed",
  "timeout",
  "crisis",
  "error",
  "rate_limited",
  "crisis_intercepted",
] as const;

export const ALLOWED_SCREENS = [
  "myth_landing",
  "myth_questions",
  "myth_generating",
  "myth_result",
  "about",
  "privacy",
  "terms",
  "delete",
] as const;

export const ALLOWED_FEEDBACK_CODES = [
  "PARAPHRASE",
  "NEW_CONNECTION",
  "USEFUL_REFRAME",
  "NOTHING",
  "OFF_TOPIC",
] as const;

export const ALLOWED_NOVELTY_CODES = ["YES", "PARTIALLY", "NO"] as const;

export interface DecisionAnalyticsEvent {
  event_name: AllowedEventName;
  anonymous_id: string;
  occurred_at: string;
  release_sha: string;
  ramp_stage: "A" | "B" | "C";
  acquisition_source?: string;
  acquisition_campaign?: string;
  screen?: typeof ALLOWED_SCREENS[number];
  duration_ms?: number;
  status?: typeof ALLOWED_STATUS_CODES[number];
  error_code?: string;
  provider?: "deepseek";
  model?: string;
  feedback_code?: typeof ALLOWED_FEEDBACK_CODES[number];
  novelty_response?: typeof ALLOWED_NOVELTY_CODES[number];
  unsupported_novel_claim?: boolean;
  classifier_version?: string;
  confidence?: number;
}

export const ALLOWED_ACQUISITION_SOURCES = [
  "direct",
  "organic",
  "telegram",
  "vk",
  "yandex",
  "share",
  "referral",
] as const;

export const ALLOWED_ACQUISITION_CAMPAIGNS = [
  "cmp_launch_2026",
  "cmp_pilot_a",
  "cmp_pilot_b",
  "cmp_direct",
  "none",
] as const;

export const ALLOWED_ERROR_CODES = [
  "timeout",
  "provider_5xx",
  "provider_429",
  "invalid_response",
  "qa_failed",
  "rate_limited",
  "crisis_intercepted",
  "validation_error",
  "client_abort",
  "provider_not_ready",
  "age_or_consent_restriction",
  "personal_myth_quality_failed",
  "personal_myth_timeout",
  "personal_myth_disabled",
  "personal_myth_failed",
  "personal_myth_provider_not_ready",
  "invalid_analytics_event",
] as const;

let cachedAuthoritativeReleaseSha: string | null = null;

export function getAuthoritativeReleaseSha(): string {
  if (cachedAuthoritativeReleaseSha) {
    return cachedAuthoritativeReleaseSha;
  }

  // 1. Try explicit environment override
  const envSha = (process.env.RELEASE_SHA || "").trim();
  if (envSha && envSha.length >= 7 && !envSha.includes(" ")) {
    cachedAuthoritativeReleaseSha = envSha;
    return envSha;
  }

  // 2. Try reading Git HEAD from checked out repository
  try {
    const gitSha = require("child_process").execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    if (gitSha && gitSha.length >= 7 && !gitSha.includes(" ")) {
      cachedAuthoritativeReleaseSha = gitSha;
      return cachedAuthoritativeReleaseSha;
    }
  } catch {}

  // 3. Try generated dist/package_manifest.json or dist/release.json (untracked build outputs)
  try {
    const pkgPath = path.join(process.cwd(), "dist", "package_manifest.json");
    if (require("fs").existsSync(pkgPath)) {
      const content = require("fs").readFileSync(pkgPath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.release_sha && parsed.release_sha.length >= 7) {
        cachedAuthoritativeReleaseSha = String(parsed.release_sha).trim();
        return cachedAuthoritativeReleaseSha;
      }
    }
  } catch {}

  try {
    const manifestPath = path.join(process.cwd(), "dist", "release.json");
    if (require("fs").existsSync(manifestPath)) {
      const content = require("fs").readFileSync(manifestPath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.release_sha && parsed.release_sha.length >= 7) {
        cachedAuthoritativeReleaseSha = String(parsed.release_sha).trim();
        return cachedAuthoritativeReleaseSha;
      }
    }
  } catch {}

  cachedAuthoritativeReleaseSha = "v1.0.0-public-v1";
  return cachedAuthoritativeReleaseSha;
}

export function setAuthoritativeReleaseSha(sha: string): void {
  cachedAuthoritativeReleaseSha = sha;
}

const STRICT_ANON_ID_REGEX = /^[a-zA-Z0-9_-]{8,120}$/;
const SENSITIVE_CONTENT_SNIFFER = /(?:@|\+7|8-800|8800|password|secret|bearer|token|cut_myself|kill_myself|suicide|пореж|убить|суицид|умереть|наглота|нож|лезви|бритв|<|>|script|javascript:|onerror|[{}[\]"\\]|[\r\n\t\x00-\x1F])/i;

export function validateAnalyticsEvent(payload: unknown): { valid: boolean; event?: DecisionAnalyticsEvent; error?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, error: "invalid_payload_object" };
  }

  const raw = payload as Record<string, unknown>;

  // Reject if any forbidden sensitive key exists
  for (const forbiddenKey of FORBIDDEN_ANALYTICS_KEYS) {
    if (forbiddenKey in raw && raw[forbiddenKey] !== undefined && raw[forbiddenKey] !== null) {
      return { valid: false, error: `forbidden_sensitive_key_detected:${forbiddenKey}` };
    }
  }

  // Sniff for sensitive patterns and control characters in all string values (excluding valid ISO timestamp occurred_at)
  for (const [key, val] of Object.entries(raw)) {
    if (key === "occurred_at") continue;
    if (typeof val === "string") {
      if (val.length > 120) {
        return { valid: false, error: `value_length_exceeded_in_field:${key}` };
      }
      if (SENSITIVE_CONTENT_SNIFFER.test(val)) {
        return { valid: false, error: `sensitive_pattern_rejected_in_field:${key}` };
      }
    }
  }

  const event_name = String(raw.event_name || "");
  if (!ALLOWED_DECISION_EVENTS.includes(event_name as AllowedEventName)) {
    return { valid: false, error: `disallowed_event_name:${event_name}` };
  }

  const anonymous_id = String(raw.anonymous_id || "").trim();
  if (!anonymous_id || !STRICT_ANON_ID_REGEX.test(anonymous_id)) {
    return { valid: false, error: "invalid_anonymous_id" };
  }

  const occurred_at = typeof raw.occurred_at === "string" && !isNaN(Date.parse(raw.occurred_at))
    ? new Date(raw.occurred_at).toISOString()
    : new Date().toISOString();

  // Release SHA is strictly server-authoritative
  const release_sha = getAuthoritativeReleaseSha();
  const ramp_stage = (raw.ramp_stage === "B" || raw.ramp_stage === "C") ? raw.ramp_stage : "A";

  const event: DecisionAnalyticsEvent = {
    event_name: event_name as AllowedEventName,
    anonymous_id,
    occurred_at,
    release_sha,
    ramp_stage,
  };

  // Field-specific validation: acquisition_source
  if (raw.acquisition_source !== undefined && raw.acquisition_source !== null) {
    if (typeof raw.acquisition_source !== "string" || !ALLOWED_ACQUISITION_SOURCES.includes(raw.acquisition_source as any)) {
      return { valid: false, error: "invalid_acquisition_source" };
    }
    event.acquisition_source = raw.acquisition_source;
  }

  // Field-specific validation: acquisition_campaign
  if (raw.acquisition_campaign !== undefined && raw.acquisition_campaign !== null) {
    if (typeof raw.acquisition_campaign !== "string" || !ALLOWED_ACQUISITION_CAMPAIGNS.includes(raw.acquisition_campaign as any)) {
      return { valid: false, error: "invalid_acquisition_campaign" };
    }
    event.acquisition_campaign = raw.acquisition_campaign;
  }

  // Field-specific validation: screen
  if (raw.screen !== undefined && raw.screen !== null) {
    if (typeof raw.screen !== "string" || !ALLOWED_SCREENS.includes(raw.screen as any)) {
      return { valid: false, error: "invalid_screen_name" };
    }
    event.screen = raw.screen as typeof ALLOWED_SCREENS[number];
  }

  // Field-specific validation: duration_ms
  if (raw.duration_ms !== undefined && raw.duration_ms !== null) {
    if (typeof raw.duration_ms !== "number" || isNaN(raw.duration_ms) || raw.duration_ms < 0 || raw.duration_ms > 600_000) {
      return { valid: false, error: "invalid_duration_ms" };
    }
    event.duration_ms = Math.round(raw.duration_ms);
  }

  // Field-specific validation: status
  if (raw.status !== undefined && raw.status !== null) {
    if (typeof raw.status !== "string" || !ALLOWED_STATUS_CODES.includes(raw.status as any)) {
      return { valid: false, error: "invalid_status_code" };
    }
    event.status = raw.status as typeof ALLOWED_STATUS_CODES[number];
  }

  // Field-specific validation: error_code
  if (raw.error_code !== undefined && raw.error_code !== null) {
    if (typeof raw.error_code !== "string" || !ALLOWED_ERROR_CODES.includes(raw.error_code as any)) {
      return { valid: false, error: "invalid_error_code" };
    }
    event.error_code = raw.error_code;
  }

  if (raw.provider === "deepseek") {
    event.provider = "deepseek";
  }

  if (raw.model !== undefined && raw.model !== null) {
    if (typeof raw.model !== "string" || (raw.model !== "deepseek-v4-pro" && raw.model !== "deepseek-chat")) {
      return { valid: false, error: "invalid_model_name" };
    }
    event.model = raw.model;
  }

  if (raw.feedback_code !== undefined && raw.feedback_code !== null) {
    if (typeof raw.feedback_code !== "string" || !ALLOWED_FEEDBACK_CODES.includes(raw.feedback_code as any)) {
      return { valid: false, error: "invalid_feedback_code" };
    }
    event.feedback_code = raw.feedback_code as typeof ALLOWED_FEEDBACK_CODES[number];
  }

  if (raw.novelty_response !== undefined && raw.novelty_response !== null) {
    if (typeof raw.novelty_response !== "string" || !ALLOWED_NOVELTY_CODES.includes(raw.novelty_response as any)) {
      return { valid: false, error: "invalid_novelty_response" };
    }
    event.novelty_response = raw.novelty_response as typeof ALLOWED_NOVELTY_CODES[number];
  }

  if (typeof raw.unsupported_novel_claim === "boolean") {
    event.unsupported_novel_claim = raw.unsupported_novel_claim;
  }

  // classifier_version is SERVER-GENERATED only
  event.classifier_version = "myth-feedback-v1.0";

  if (raw.confidence !== undefined && raw.confidence !== null) {
    if (typeof raw.confidence !== "number" || isNaN(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
      return { valid: false, error: "invalid_confidence_score" };
    }
    event.confidence = raw.confidence;
  }

  return { valid: true, event };
}

export async function logDecisionEvent(event: DecisionAnalyticsEvent): Promise<void> {
  try {
    const eventsDir = path.join(process.cwd(), "data", "events");
    await fs.mkdir(eventsDir, { recursive: true });
    const line = JSON.stringify(event) + "\n";
    await fs.appendFile(path.join(eventsDir, "events.jsonl"), line, "utf-8");
  } catch (err) {
    console.warn("[Analytics] Failed to persist decision event:", err);
  }
}

export const ANALYTICS_MAX_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * Enforces 90-day TTL on analytics events log.
 * Supports fake/injected clock for deterministic testing.
 */
export async function enforceAnalyticsTTL(nowMs: number = Date.now()): Promise<number> {
  try {
    const eventsFile = path.join(process.cwd(), "data", "events", "events.jsonl");
    let content = "";
    try {
      content = await fs.readFile(eventsFile, "utf-8");
    } catch {
      return 0;
    }

    const lines = content.split("\n").filter(Boolean);
    const cutoff = nowMs - ANALYTICS_MAX_RETENTION_MS;
    let prunedCount = 0;

    const validLines = lines.filter((line) => {
      try {
        const parsed = JSON.parse(line);
        const eventTime = Date.parse(parsed.occurred_at);
        if (isNaN(eventTime) || eventTime < cutoff) {
          prunedCount += 1;
          return false;
        }
        return true;
      } catch {
        prunedCount += 1;
        return false;
      }
    });

    await fs.writeFile(eventsFile, validLines.join("\n") + (validLines.length ? "\n" : ""), "utf-8");
    return prunedCount;
  } catch (err) {
    console.warn("[Analytics] Error enforcing TTL:", err);
    return 0;
  }
}

export interface AnalyticsDeletionOutcome {
  success: boolean;
  deletedCount: number;
  matchedCount: number;
  error?: string;
}

export async function deleteEventsForAnonymousId(
  anonymousIdOrIds: string | string[]
): Promise<AnalyticsDeletionOutcome> {
  try {
    const targetList = Array.isArray(anonymousIdOrIds) ? anonymousIdOrIds : [anonymousIdOrIds];
    const ids = new Set(targetList.map((s) => String(s || "").trim()).filter(Boolean));
    if (ids.size === 0) {
      return { success: true, deletedCount: 0, matchedCount: 0 };
    }

    const eventsFile = path.join(process.cwd(), "data", "events", "events.jsonl");
    let content = "";
    try {
      content = await fs.readFile(eventsFile, "utf-8");
    } catch (err: any) {
      if (err && err.code === "ENOENT") {
        return { success: true, deletedCount: 0, matchedCount: 0 };
      }
      console.warn("[Analytics] Error reading events file during deletion:", err);
      return { success: false, deletedCount: 0, matchedCount: 0, error: "analytics_read_failed" };
    }

    const lines = content.split("\n").filter(Boolean);
    let matchedCount = 0;
    const keptLines = lines.filter((l) => {
      try {
        const parsed = JSON.parse(l);
        if (ids.has(parsed.anonymous_id) || (parsed.session_token && ids.has(parsed.session_token))) {
          matchedCount++;
          return false;
        }
        return true;
      } catch {
        return false;
      }
    });

    if (matchedCount === 0) {
      // Nothing to delete, invariant satisfied idempotently
      return { success: true, deletedCount: 0, matchedCount: 0 };
    }

    // Verify writability of events file and directory before write
    try {
      if (fsSync.existsSync(eventsFile)) {
        fsSync.accessSync(eventsFile, fsSync.constants.W_OK);
      }
      fsSync.accessSync(path.dirname(eventsFile), fsSync.constants.W_OK);
      await fs.writeFile(eventsFile, keptLines.join("\n") + (keptLines.length ? "\n" : ""), "utf-8");
      return { success: true, deletedCount: matchedCount, matchedCount };
    } catch (err) {
      console.warn("[Analytics] Error writing events file during deletion:", err);
      return { success: false, deletedCount: 0, matchedCount, error: "analytics_write_failed" };
    }
  } catch (err) {
    console.warn("[Analytics] Error purging events for IDs:", err);
    return { success: false, deletedCount: 0, matchedCount: 0, error: "analytics_purge_failed" };
  }
}
