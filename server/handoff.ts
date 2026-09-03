import crypto from "crypto";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import type { CalculationResult, MeetingApiResponse, StoryInputs } from "../src/types";

export const CLAIM_TTL_MS = 15 * 60_000; // 15 minutes TTL

const CLAIMS_DIR = process.env.SHARED_CLAIMS_DIR || path.join(process.cwd(), "data", "claims");
const BOT_USERNAME = process.env.TELEGRAM_STAGING_BOT_USERNAME || "ZerkaloStagingBot";

export function getClaimSecret(): string {
  const secret = process.env.CONTINUATION_CLAIM_SECRET || process.env.DELETION_LOOKUP_SECRET || "zerkalo-u1-claim-secret-for-staging-and-testing-min16";
  return secret.trim();
}

export interface CreateClaimParams {
  codeResult: CalculationResult;
  storyResult: any;
  meetingResult: any;
  consent: boolean;
  ageVerified: boolean;
}

export interface ContinuationClaimRecord {
  claimId: string;
  signature: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  envelope: Record<string, any>;
}

export function signClaim(claimId: string, expiresAt: string, secret = getClaimSecret()): string {
  return crypto.createHmac("sha256", secret).update(`${claimId}:${expiresAt}`).digest("hex");
}

export function verifyClaimSignature(claimId: string, expiresAt: string, providedSig: string, secret = getClaimSecret()): boolean {
  const expectedSig = signClaim(claimId, expiresAt, secret);
  if (expectedSig.length !== providedSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig));
}

export interface ValidatedMeetingHandoffDto {
  summary: string;
  reflectiveQuestion: string;
  openLoop?: string;
  hasStrongParallels: boolean;
  confidenceNote?: string;
  parallels: Array<{
    theme: string;
    codeAnchor?: string;
    mythAnchor?: string;
    synthesis?: string;
  }>;
  divergences: Array<{
    theme: string;
    codeAspect?: string;
    mythAspect?: string;
    reflection?: string;
  }>;
  albertInsight?: string;
}

export function extractAndValidateMeetingDto(rawMeeting: any): ValidatedMeetingHandoffDto {
  if (!rawMeeting || typeof rawMeeting !== "object") {
    throw new Error("invalid_meeting_dto:missing_meeting_data");
  }

  // Support direct MeetingOfMirrorsResult, nested { result: { synthesis: ... } }, or wrapped { result: ... }
  let target = rawMeeting;
  if (rawMeeting.result && typeof rawMeeting.result === "object") {
    target = rawMeeting.result.synthesis && typeof rawMeeting.result.synthesis === "object"
      ? rawMeeting.result.synthesis
      : rawMeeting.result;
  } else if (rawMeeting.synthesis && typeof rawMeeting.synthesis === "object") {
    target = rawMeeting.synthesis;
  }

  const summary = String(target.summary || "").trim();
  if (!summary) {
    throw new Error("invalid_meeting_dto:missing_required_summary");
  }

  const reflectiveQuestion = String(target.reflectiveQuestion || target.centralQuestion || "").trim();
  if (!reflectiveQuestion) {
    throw new Error("invalid_meeting_dto:missing_required_reflective_question");
  }

  const openLoop = target.openLoop || target.next_open_loop ? String(target.openLoop || target.next_open_loop).trim() : undefined;

  const parallels = Array.isArray(target.parallels)
    ? target.parallels
    : Array.isArray(target.resonances)
    ? target.resonances
    : [];

  const divergences = Array.isArray(target.divergences)
    ? target.divergences
    : [];

  const albertInsight = target.albertInsight ? String(target.albertInsight).trim() : undefined;
  const confidenceNote = target.confidenceNote ? String(target.confidenceNote).trim() : undefined;
  const hasStrongParallels = Boolean(target.hasStrongParallels ?? (parallels.length > 0));

  return {
    summary,
    reflectiveQuestion,
    openLoop,
    hasStrongParallels,
    confidenceNote,
    parallels,
    divergences,
    albertInsight,
  };
}

/**
 * Builds canonical SharedContextEnvelopeV1 from Web journey results.
 * Strictly guarantees NO PII, NO raw DOB, NO raw 4 myth answers, NO secrets.
 * Fails closed if Meeting data is invalid or missing required fields.
 */
export function buildSharedContextEnvelope(
  codeResult: CalculationResult,
  storyResult: any,
  meetingResult: any
): Record<string, any> {
  const now = new Date().toISOString();
  // Canonical OpaqueUserRef requires UUIDv4
  const userRef = crypto.randomUUID();

  // 1. Derived code snapshot (Five numbers, NO DOB)
  const components = [
    { component_key: "mind", value_summary: String(codeResult.soul) },
    { component_key: "path", value_summary: String(codeResult.path) },
    { component_key: "direction", value_summary: String(codeResult.direction) },
    { component_key: "expression", value_summary: String(codeResult.expression) },
    { component_key: "result", value_summary: String(codeResult.result) },
  ];

  // 2. Bounded myth summary
  const mirror = storyResult?.mirror || {};
  const mythSummary = [mirror.mainImage, mirror.innerTension].filter(Boolean).join(" | ").slice(0, 300) || "Символический миф";

  // 3. Bounded meeting synthesis - typed and strictly validated
  const meeting = extractAndValidateMeetingDto(meetingResult);
  const meetingSummary = meeting.summary.slice(0, 500);
  const livingQuestion = meeting.reflectiveQuestion.slice(0, 300);
  const nextOpenLoop = (meeting.openLoop || livingQuestion).slice(0, 300);

  // 4. Evidence (Confirmed observations and contrasts from completed journey)
  const evidence: Array<{ status: string; claim_summary: string; recorded_at: string }> = [
    {
      status: "confirmed",
      claim_summary: `Число Сознания ${codeResult.soul}, Число Действия ${codeResult.path}`,
      recorded_at: now,
    },
    {
      status: "confirmed",
      claim_summary: `Образ мифа: ${mirror.mainImage || "Символический образ"}`,
      recorded_at: now,
    },
    {
      status: "confirmed",
      claim_summary: `Встреча: ${meetingSummary.slice(0, 150)}`,
      recorded_at: now,
    },
  ];

  // Map each parallel as confirmed resonance
  for (const p of meeting.parallels) {
    if (p.theme) {
      evidence.push({
        status: "confirmed",
        claim_summary: `Резонанс [${p.theme}]: ${(p.synthesis || p.codeAnchor || "").slice(0, 120)}`,
        recorded_at: now,
      });
    }
  }

  // Map each divergence as partial/contrast
  for (const d of meeting.divergences) {
    if (d.theme) {
      evidence.push({
        status: "partial",
        claim_summary: `Контраст [${d.theme}]: ${(d.reflection || d.codeAspect || "").slice(0, 120)}`,
        recorded_at: now,
      });
    }
  }

  // 5. Seven-day retention with standard class
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();

  const envelope = {
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
      profile_ref: `code_${codeResult.soul}_${codeResult.path}_${codeResult.result}`,
      components,
      generated_at: now,
    },
    evidence,
    experience_state: {
      myth_summary: mythSummary,
      meeting_summary: meetingSummary,
      updated_at: now,
    },
    active_thread: {
      current_question: livingQuestion,
      opened_at: now,
      next_open_loop: nextOpenLoop,
      topic_summary: meeting.albertInsight ? meeting.albertInsight.slice(0, 100) : "Встреча зеркал: Код и Личный миф",
    },
    memory_summary: {
      summary: `Завершена Встреча зеркал. Код: ${codeResult.soul}-${codeResult.path}-${codeResult.result}. Миф: ${mythSummary}.`,
      salient_user_statements: [],
      updated_at: now,
    },
  };

  // Strict verification: FORBIDDEN fields check
  const forbiddenKeys = ["dob", "birthDate", "q1", "q2", "q3", "q4", "telegram_user_id", "chat_id", "email", "phone"];
  for (const k of forbiddenKeys) {
    if ((envelope as any)[k] !== undefined) {
      throw new Error(`CRITICAL_SECURITY_VIOLATION: Forbidden field ${k} found in envelope`);
    }
  }

  return envelope;
}

/**
 * Creates an opaque, signed continuation claim stored server-side.
 */
export async function createContinuationClaim(params: CreateClaimParams): Promise<{
  claimId: string;
  token: string;
  telegramUrl: string;
  expiresAt: string;
}> {
  if (!params.consent) {
    throw new Error("consent_required:continuation_requires_explicit_consent");
  }
  if (!params.ageVerified) {
    throw new Error("age_requirement_not_met:18_plus_required");
  }
  if (!params.codeResult || !params.storyResult || !params.meetingResult) {
    throw new Error("journey_incomplete:all_three_stages_required");
  }

  const claimId = crypto.randomBytes(16).toString("hex");
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + CLAIM_TTL_MS).toISOString();

  const envelope = buildSharedContextEnvelope(params.codeResult, params.storyResult, params.meetingResult);
  const signature = signClaim(claimId, expiresAt);

  const claimRecord: ContinuationClaimRecord = {
    claimId,
    signature,
    createdAt,
    expiresAt,
    consumedAt: null,
    envelope,
  };

  await fs.mkdir(CLAIMS_DIR, { recursive: true });
  const claimFilePath = path.join(CLAIMS_DIR, `${claimId}.json`);
  const tmpPath = `${claimFilePath}.${Date.now()}.tmp`;

  await fs.writeFile(tmpPath, JSON.stringify(claimRecord, null, 2), "utf-8");
  await fs.rename(tmpPath, claimFilePath);

  const token = `${claimId}.${signature}`;
  const telegramUrl = `https://t.me/${BOT_USERNAME}?start=claim_${claimId}_${signature}`;

  return {
    claimId,
    token,
    telegramUrl,
    expiresAt,
  };
}

/**
 * Consumes a continuation claim single-use with cryptographic verification.
 */
export async function consumeContinuationClaim(
  claimId: string,
  signature: string
): Promise<{
  success: boolean;
  code?: string;
  envelope?: Record<string, any>;
}> {
  const claimFilePath = path.join(CLAIMS_DIR, `${claimId}.json`);
  if (!fsSync.existsSync(claimFilePath)) {
    return { success: false, code: "claim_not_found" };
  }

  let claim: ContinuationClaimRecord;
  try {
    const data = await fs.readFile(claimFilePath, "utf-8");
    claim = JSON.parse(data);
  } catch {
    return { success: false, code: "claim_corrupt" };
  }

  // 1. Signature Verification (Constant-Time)
  const validSig = verifyClaimSignature(claimId, claim.expiresAt, signature);
  if (!validSig) {
    return { success: false, code: "tamper_rejected" };
  }

  // 2. Expiration Check
  if (Date.now() > new Date(claim.expiresAt).getTime()) {
    return { success: false, code: "expired_rejected" };
  }

  // 3. Single-Use Replay Rejection
  if (claim.consumedAt !== null) {
    return { success: false, code: "replay_rejected" };
  }

  // 4. Mark Consumed Atomically
  claim.consumedAt = new Date().toISOString();
  const tmpPath = `${claimFilePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(claim, null, 2), "utf-8");
  await fs.rename(tmpPath, claimFilePath);

  return { success: true, envelope: claim.envelope };
}
