import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";

export type FeedbackDerivedCode =
  | "PARAPHRASE"
  | "NEW_CONNECTION"
  | "USEFUL_REFRAME"
  | "NOTHING"
  | "OFF_TOPIC";

export type ClosedNoveltyResponse = "YES" | "PARTIALLY" | "NO";

export interface ClassificationResult {
  feedback_code: FeedbackDerivedCode;
  novelty_response: ClosedNoveltyResponse;
  unsupported_novel_claim: boolean;
  classifier_version: string;
  confidence: number;
}

export const CLASSIFIER_VERSION = "myth-feedback-v1.0";

export function classifyTakeaway(
  rawText: string,
  closedNovelty: ClosedNoveltyResponse,
): ClassificationResult {
  const text = (rawText || "").trim().toLowerCase();

  // Check for nothing / empty / dismissive
  const nothingPatterns = [
    /^$/,
    /^[-–—.]+$/,
    /^(?:нет|ничего|ничего\s+особенного|ничего\s+нового|пустота|ноль|ерунда|бред|вода|ни\s+о\s+ч[её]м|бессмыслица|чушь|не\s+знаю)$/iu,
    /не\s+увидел\s+смысла/iu,
    /никаких\s+мыслей/iu,
  ];
  if (nothingPatterns.some((p) => p.test(text))) {
    return {
      feedback_code: "NOTHING",
      novelty_response: closedNovelty,
      unsupported_novel_claim: false,
      classifier_version: CLASSIFIER_VERSION,
      confidence: 0.95,
    };
  }

  // Check for off-topic / keyboard mash / UI critique
  const offTopicPatterns = [
    /^[asdfghjklqwertyuiopzxcvbnm1234567890!@#$%^&*()_+=\[\]{}]{1,10}$/iu,
    /(?:сайт|шрифт|кнопк\w*|дизайн|баг\w*|ошибк\w*|тормозит|завис)/iu,
  ];
  if (text.length < 3 || offTopicPatterns.some((p) => p.test(text))) {
    return {
      feedback_code: "OFF_TOPIC",
      novelty_response: closedNovelty,
      unsupported_novel_claim: false,
      classifier_version: CLASSIFIER_VERSION,
      confidence: 0.85,
    };
  }

  // Check for unsupported novel claims (fortune-telling, diagnosis, psychic claims)
  const unsupportedPatterns = [
    /(?:предсказал|нагадал|будущее\s+будет|ясновидени\w*|магия|диагноз|болезнь\s+вылеч\w*|выиграю\s+в\s+лотерею)/iu,
  ];
  const unsupported_novel_claim = unsupportedPatterns.some((p) => p.test(text));

  // Check for Useful Reframe (perspective shift, practical psychological shift)
  const reframePatterns = [
    /(?:взглянул|посмотрел|увидел|понял|осознал)\s+(?:по-другому|с\s+другой\s+стороны|иначе|с\s+нового\s+угла|с\s+неожиданной\s+стороны)/iu,
    /(?:переосмыслил|разрешил\s+себе|снял\s+напряжение|можно\s+не\s+спешить|отпустить\s+контроль|перестал\s+бояться)/iu,
    /(?:сместил\s+фокус|другой\s+ракурс|новый\s+взгляд|ясность\s+в\s+том|точка\s+опоры)/iu,
  ];
  if (reframePatterns.some((p) => p.test(text))) {
    return {
      feedback_code: "USEFUL_REFRAME",
      novelty_response: closedNovelty,
      unsupported_novel_claim,
      classifier_version: CLASSIFIER_VERSION,
      confidence: 0.88,
    };
  }

  // Check for New Connection (associating disparate elements)
  const connectionPatterns = [
    /(?:связал|соединил|связь\s+между|параллель|сопоставил|увидел\s+мост|оказывается.*связано)/iu,
    /(?:образ.*напомнил|метафора.*отражает|через.*понял)/iu,
  ];
  if (connectionPatterns.some((p) => p.test(text))) {
    return {
      feedback_code: "NEW_CONNECTION",
      novelty_response: closedNovelty,
      unsupported_novel_claim,
      classifier_version: CLASSIFIER_VERSION,
      confidence: 0.82,
    };
  }

  // If closed response indicates new insight
  if (closedNovelty === "YES") {
    return {
      feedback_code: "NEW_CONNECTION",
      novelty_response: closedNovelty,
      unsupported_novel_claim,
      classifier_version: CLASSIFIER_VERSION,
      confidence: 0.75,
    };
  }

  if (closedNovelty === "PARTIALLY") {
    return {
      feedback_code: "USEFUL_REFRAME",
      novelty_response: closedNovelty,
      unsupported_novel_claim,
      classifier_version: CLASSIFIER_VERSION,
      confidence: 0.7,
    };
  }

  // Default to paraphrase
  return {
    feedback_code: "PARAPHRASE",
    novelty_response: closedNovelty,
    unsupported_novel_claim,
    classifier_version: CLASSIFIER_VERSION,
    confidence: 0.7,
  };
}

export interface QualitativeFeedbackRecord {
  id: string;
  session_token: string;
  anonymous_id: string;
  occurred_at: string;
  expires_at: string;
  raw_text: string;
  feedback_code: FeedbackDerivedCode;
  novelty_response: ClosedNoveltyResponse;
  unsupported_novel_claim: boolean;
  opt_in_research: true;
}

export function deriveFeedbackLinkId(rawToken: string): string {
  const secret = process.env.DELETION_LOOKUP_SECRET || process.env.QUALITATIVE_FEEDBACK_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("Secret is required to derive feedback link id");
  }
  return crypto.createHmac("sha256", secret.trim()).update("feedback:" + String(rawToken || "").trim()).digest("hex");
}

export interface EncryptedFeedbackEnvelope {
  version: "aes-256-gcm-v1";
  feedback_link_id: string;
  anonymous_id: string;
  occurred_at: string;
  expires_at: string;
  iv: string;
  tag: string;
  ciphertext: string;
  feedback_code: FeedbackDerivedCode;
  novelty_response: ClosedNoveltyResponse;
  unsupported_novel_claim: boolean;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.QUALITATIVE_FEEDBACK_SECRET || process.env.FEEDBACK_ENCRYPTION_KEY;
  if (!secret || secret.trim().length < 16) {
    throw new Error("qualitative_feedback_encryption_key_missing");
  }
  return crypto.createHash("sha256").update(secret.trim()).digest();
}

export function encryptPayload(plainText: string): { iv: string; tag: string; ciphertext: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainText, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return {
    iv: iv.toString("hex"),
    tag,
    ciphertext: encrypted,
  };
}

export function decryptPayload(envelope: { iv: string; tag: string; ciphertext: string }): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "hex"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  let decrypted = decipher.update(envelope.ciphertext, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

export async function saveQualitativeFeedback(record: QualitativeFeedbackRecord): Promise<void> {
  const dir = path.join(process.cwd(), "data", "feedback_qualitative");
  await fs.mkdir(dir, { recursive: true });

  const { iv, tag, ciphertext } = encryptPayload(record.raw_text);
  const feedbackLinkId = deriveFeedbackLinkId(record.session_token);

  const envelope: EncryptedFeedbackEnvelope = {
    version: "aes-256-gcm-v1",
    feedback_link_id: feedbackLinkId,
    anonymous_id: record.anonymous_id,
    occurred_at: record.occurred_at,
    expires_at: record.expires_at,
    iv,
    tag,
    ciphertext,
    feedback_code: record.feedback_code,
    novelty_response: record.novelty_response,
    unsupported_novel_claim: record.unsupported_novel_claim,
  };

  const filename = path.join(dir, `${feedbackLinkId}.json`);
  await fs.writeFile(filename, JSON.stringify(envelope, null, 2), "utf-8");
}

export const QUALITATIVE_FEEDBACK_MAX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Enforces 30-day TTL on qualitative feedback storage.
 * Supports fake/injected clock for deterministic testing.
 */
export async function enforceQualitativeFeedbackTTL(nowMs: number = Date.now()): Promise<number> {
  try {
    const dir = path.join(process.cwd(), "data", "feedback_qualitative");
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      return 0;
    }

    let prunedCount = 0;
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filepath = path.join(dir, file);
      try {
        const content = await fs.readFile(filepath, "utf-8");
        const parsed = JSON.parse(content);
        const expiresAtMs = Date.parse(parsed.expires_at);
        if (isNaN(expiresAtMs) || expiresAtMs <= nowMs) {
          await fs.unlink(filepath);
          prunedCount += 1;
        }
      } catch {
        // Purge unreadable/corrupted files
        await fs.unlink(filepath).catch(() => {});
        prunedCount += 1;
      }
    }
    return prunedCount;
  } catch (err) {
    console.warn("[Feedback] Error enforcing TTL on qualitative feedback:", err);
    return 0;
  }
}

export interface FeedbackDeletionOutcome {
  success: boolean;
  purgedCount: number;
  matchedCount: number;
  error?: string;
}

export async function deleteQualitativeFeedback(
  tokenOrAnonymousId: string | string[]
): Promise<FeedbackDeletionOutcome> {
  try {
    const dir = path.join(process.cwd(), "data", "feedback_qualitative");
    const rawIds = (Array.isArray(tokenOrAnonymousId) ? tokenOrAnonymousId : [tokenOrAnonymousId])
      .map((id) => String(id || "").trim())
      .filter(Boolean);

    if (rawIds.length === 0) {
      return { success: true, purgedCount: 0, matchedCount: 0 };
    }

    let files: string[] = [];
    try {
      if (!fsSync.existsSync(dir)) {
        return { success: true, purgedCount: 0, matchedCount: 0 };
      }
      files = await fs.readdir(dir);
    } catch (err: any) {
      if (err && err.code === "ENOENT") {
        return { success: true, purgedCount: 0, matchedCount: 0 };
      }
      console.warn("[Feedback] Error reading qualitative feedback dir:", err);
      return { success: false, purgedCount: 0, matchedCount: 0, error: "feedback_dir_read_failed" };
    }

    const linkIds = new Set<string>();
    for (const rawId of rawIds) {
      try {
        const linkId = deriveFeedbackLinkId(rawId);
        if (linkId) linkIds.add(linkId);
      } catch {}
    }
    const rawIdSet = new Set(rawIds);

    let matchedCount = 0;
    let purgedCount = 0;
    const failedUnlinks: string[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filepath = path.join(dir, file);
      const base = file.slice(0, -5);

      let isMatch = false;
      if (rawIdSet.has(base) || linkIds.has(base)) {
        isMatch = true;
      } else {
        try {
          const content = await fs.readFile(filepath, "utf-8");
          const parsed = JSON.parse(content);
          if (
            (parsed.feedback_link_id && (rawIdSet.has(parsed.feedback_link_id) || linkIds.has(parsed.feedback_link_id))) ||
            (parsed.anonymous_id && rawIdSet.has(parsed.anonymous_id)) ||
            (parsed.session_token && rawIdSet.has(parsed.session_token))
          ) {
            isMatch = true;
          }
        } catch {
          // ignore unparseable
        }
      }

      if (isMatch) {
        matchedCount++;
        try {
          // Check writability of target file before unlinking
          fsSync.accessSync(filepath, fsSync.constants.W_OK);
          fsSync.accessSync(dir, fsSync.constants.W_OK);
          await fs.unlink(filepath);
          purgedCount++;
        } catch (err) {
          console.warn(`[Feedback] Failed to unlink feedback file ${file}:`, err);
          failedUnlinks.push(file);
        }
      }
    }

    if (failedUnlinks.length > 0) {
      return {
        success: false,
        purgedCount,
        matchedCount,
        error: "feedback_unlink_failed",
      };
    }

    return {
      success: true,
      purgedCount,
      matchedCount,
    };
  } catch (err) {
    console.warn("[Feedback] Error purging qualitative feedback:", err);
    return { success: false, purgedCount: 0, matchedCount: 0, error: "feedback_purge_failed" };
  }
}

export async function getDecryptedQualitativeFeedback(sessionToken: string): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), "data", "feedback_qualitative");
    let linkId = sessionToken;
    try {
      linkId = deriveFeedbackLinkId(sessionToken);
    } catch {}

    let filepath = path.join(dir, `${linkId}.json`);
    try {
      await fs.access(filepath);
    } catch {
      filepath = path.join(dir, `${sessionToken}.json`);
    }
    const content = await fs.readFile(filepath, "utf-8");
    const parsed: EncryptedFeedbackEnvelope = JSON.parse(content);
    return decryptPayload(parsed);
  } catch {
    return null;
  }
}
