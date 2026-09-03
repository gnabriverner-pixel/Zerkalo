import fs from "fs";
import path from "path";
import crypto from "crypto";
import { deleteEventsForAnonymousId } from "./analytics";
import { deleteQualitativeFeedback } from "./feedback";

export interface DeletionResult {
  status: "ok" | "error";
  purgedEventsCount: number;
  purgedQualitativeRecord: boolean;
  purgedCacheCount: number;
  message: string;
  code?: string;
  retryable?: boolean;
}

type CachePurger = (tokenOrKey: string) => number;
const cachePurgers: CachePurger[] = [];

export function registerCachePurger(purger: CachePurger): void {
  cachePurgers.push(purger);
}

export interface StoredDeletionScope {
  lookup_key: string;
  anonymous_ids: string[];
  opaque_session_identifiers: string[];
  cache_keys: string[];
  created_at: number;
  expires_at: number;
}

export interface DeletionScopesFileEnvelope {
  version: "1";
  secret_fingerprint: string;
  scopes: StoredDeletionScope[];
}

export const DELETION_SCOPE_MAX_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days (matches MAX_LINKED_DATA_RETENTION)

const SCOPES_FILE = path.join(process.cwd(), "data", "deletion_scopes.json");

export function getDeletionLookupSecret(): string {
  const secret = process.env.DELETION_LOOKUP_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("CRITICAL: DELETION_LOOKUP_SECRET is required and must be at least 16 characters (no fallback allowed)");
  }
  return secret.trim();
}

export function getDeletionSecretFingerprint(secret?: string): string {
  const s = secret || getDeletionLookupSecret();
  return crypto.createHmac("sha256", s).update("deletion_scope_secret_fingerprint_v1").digest("hex").slice(0, 16);
}

export function deriveLookupKey(raw: string): string {
  const secret = getDeletionLookupSecret();
  return crypto.createHmac("sha256", secret).update(String(raw || "").trim()).digest("hex");
}

function loadScopesFromDisk(): Map<string, StoredDeletionScope> {
  const map = new Map<string, StoredDeletionScope>();
  try {
    if (fs.existsSync(SCOPES_FILE)) {
      const raw = fs.readFileSync(SCOPES_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      let list: StoredDeletionScope[] = [];
      let savedFingerprint: string | undefined;

      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && Array.isArray(parsed.scopes)) {
        list = parsed.scopes;
        savedFingerprint = parsed.secret_fingerprint;
      }

      if (list.length > 0 && savedFingerprint && process.env.DELETION_LOOKUP_SECRET) {
        const currentFingerprint = getDeletionSecretFingerprint();
        if (savedFingerprint !== currentFingerprint) {
          throw new Error(
            `DELETION_LOOKUP_SECRET mismatch: persisted scopes have fingerprint ${savedFingerprint}, but active secret has ${currentFingerprint}. Startup rejected to prevent orphaning deletion associations.`
          );
        }
      }

      for (const item of list) {
        if (item && item.lookup_key) {
          map.set(item.lookup_key, item);
        }
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes("DELETION_LOOKUP_SECRET mismatch")) {
      throw err;
    }
    console.warn("[Deletion] Could not load deletion_scopes.json:", err);
  }
  return map;
}

export function verifyDeletionSecretStability(): void {
  if (fs.existsSync(SCOPES_FILE)) {
    const raw = fs.readFileSync(SCOPES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    let list: StoredDeletionScope[] = [];
    let savedFingerprint: string | undefined;

    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && Array.isArray(parsed.scopes)) {
      list = parsed.scopes;
      savedFingerprint = parsed.secret_fingerprint;
    }

    if (list.length > 0 && savedFingerprint) {
      const currentFingerprint = getDeletionSecretFingerprint();
      if (savedFingerprint !== currentFingerprint) {
        throw new Error(
          `DELETION_LOOKUP_SECRET mismatch: persisted scopes have fingerprint ${savedFingerprint}, but active secret has ${currentFingerprint}. Startup rejected to prevent orphaning deletion associations.`
        );
      }
    }
  }
}

function saveScopesToDisk(map: Map<string, StoredDeletionScope>): boolean {
  let tmpPath: string | null = null;
  try {
    const dir = path.dirname(SCOPES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Verify writability of directory and existing file
    fs.accessSync(dir, fs.constants.W_OK);
    if (fs.existsSync(SCOPES_FILE)) {
      fs.accessSync(SCOPES_FILE, fs.constants.W_OK);
    }

    const uniqueMap = new Map<string, StoredDeletionScope>();
    for (const scope of map.values()) {
      if (scope && scope.lookup_key) {
        uniqueMap.set(scope.lookup_key, scope);
      }
    }
    const list = Array.from(uniqueMap.values());
    const envelope: DeletionScopesFileEnvelope = {
      version: "1",
      secret_fingerprint: getDeletionSecretFingerprint(),
      scopes: list,
    };
    tmpPath = `${SCOPES_FILE}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tmpPath, JSON.stringify(envelope, null, 2), "utf-8");
    fs.renameSync(tmpPath, SCOPES_FILE);
    return true;
  } catch (err) {
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
    console.warn("[Deletion] Could not save deletion_scopes.json:", err);
    return false;
  }
}

// In-memory cache backed by disk
const deletionScopes = loadScopesFromDisk();

export function registerDeletionScope(
  deletionToken: string,
  data: { anonymousId?: string; sessionToken?: string; cacheKey?: string }
): void {
  const token = String(deletionToken || "").trim();
  if (!token) return;

  const lookupKey = deriveLookupKey(token);
  let scope = deletionScopes.get(lookupKey);
  if (!scope) {
    const now = Date.now();
    scope = {
      lookup_key: lookupKey,
      anonymous_ids: [],
      opaque_session_identifiers: [],
      cache_keys: [],
      created_at: now,
      expires_at: now + DELETION_SCOPE_MAX_RETENTION_MS,
    };
  }

  if (data.anonymousId && !scope.anonymous_ids.includes(data.anonymousId)) {
    scope.anonymous_ids.push(data.anonymousId);
  }
  if (data.sessionToken) {
    // Only store one-way derived lookup identifier, NEVER the raw session token
    const opaqueSessionId = deriveLookupKey(data.sessionToken);
    if (!scope.opaque_session_identifiers.includes(opaqueSessionId)) {
      scope.opaque_session_identifiers.push(opaqueSessionId);
    }
  }
  if (data.cacheKey && !scope.cache_keys.includes(data.cacheKey)) {
    scope.cache_keys.push(data.cacheKey);
  }

  deletionScopes.set(lookupKey, scope);

  if (data.sessionToken) {
    const sLookup = deriveLookupKey(data.sessionToken);
    deletionScopes.set(sLookup, scope);
  }
  if (data.anonymousId) {
    const aLookup = deriveLookupKey(data.anonymousId);
    deletionScopes.set(aLookup, scope);
  }

  saveScopesToDisk(deletionScopes);
}

export function linkAnonymousIdToDeletionToken(tokenOrSession: string, anonymousId: string): void {
  const token = String(tokenOrSession || "").trim();
  const anon = String(anonymousId || "").trim();
  if (!token || !anon) return;

  const lookupKey = deriveLookupKey(token);
  let scope = deletionScopes.get(lookupKey);
  if (!scope) {
    const now = Date.now();
    scope = {
      lookup_key: lookupKey,
      anonymous_ids: [],
      opaque_session_identifiers: [],
      cache_keys: [],
      created_at: now,
      expires_at: now + DELETION_SCOPE_MAX_RETENTION_MS,
    };
  }

  if (!scope.anonymous_ids.includes(anon)) {
    scope.anonymous_ids.push(anon);
  }
  deletionScopes.set(lookupKey, scope);
  deletionScopes.set(deriveLookupKey(anon), scope);

  saveScopesToDisk(deletionScopes);
}

export function purgeExpiredDeletionScopes(nowMs: number = Date.now()): number {
  let pruned = 0;
  for (const [key, scope] of deletionScopes.entries()) {
    if (nowMs - scope.created_at > DELETION_SCOPE_MAX_RETENTION_MS) {
      deletionScopes.delete(key);
      pruned++;
    }
  }
  if (pruned > 0) {
    saveScopesToDisk(deletionScopes);
  }
  return pruned;
}

export async function executeDataDeletion(tokenOrAnonymousId: string): Promise<DeletionResult> {
  const cleanId = String(tokenOrAnonymousId || "").trim();
  if (!cleanId || cleanId.length < 8) {
    return {
      status: "error",
      purgedEventsCount: 0,
      purgedQualitativeRecord: false,
      purgedCacheCount: 0,
      code: "invalid_token",
      message: "Некорректный идентификатор сессии.",
    };
  }

  // Reload latest from disk to ensure cross-process / restart durability
  const diskScopes = loadScopesFromDisk();
  for (const [k, v] of diskScopes.entries()) {
    deletionScopes.set(k, v);
  }

  const lookupKey = deriveLookupKey(cleanId);
  const scope = deletionScopes.get(lookupKey);
  if (!scope) {
    return {
      status: "error",
      purgedEventsCount: 0,
      purgedQualitativeRecord: false,
      purgedCacheCount: 0,
      code: "deletion_scope_not_found",
      message: "Идентификатор сессии не найден или срок действия сессии истёк.",
    };
  }

  const targetIds = new Set<string>([cleanId]);
  const cacheKeysToPurge = new Set<string>([cleanId]);

  for (const anon of scope.anonymous_ids) targetIds.add(anon);
  for (const key of scope.cache_keys) cacheKeysToPurge.add(key);
  const targetIdList = Array.from(targetIds);

  // 1. Purge matching analytics events across all associated pseudonymous IDs
  const analyticsOutcome = await deleteEventsForAnonymousId(targetIdList);

  // 2. Purge qualitative feedback files for any of the session/anon IDs
  const feedbackOutcome = await deleteQualitativeFeedback(targetIdList);

  // 3. Purge matching cache entries
  let purgedCacheCount = 0;
  for (const key of cacheKeysToPurge) {
    for (const purger of cachePurgers) {
      try {
        purgedCacheCount += purger(key);
      } catch {
        // ignore
      }
    }
  }

  // 4. Verify that all required linked persistence deletions succeeded.
  // If ANY store write/delete fails:
  // - MUST NOT return HTTP 200 success
  // - MUST NOT say all data was deleted
  // - MUST return explicit safe failure (deletion_incomplete)
  // - deletion scope MUST remain available for retry
  // - already deleted data does NOT need to be restored
  if (!analyticsOutcome.success || !feedbackOutcome.success) {
    console.warn("[Deletion] Linked store deletion incomplete:", {
      analyticsSuccess: analyticsOutcome.success,
      feedbackSuccess: feedbackOutcome.success,
    });
    return {
      status: "error",
      code: "deletion_incomplete",
      retryable: true,
      purgedEventsCount: analyticsOutcome.deletedCount,
      purgedQualitativeRecord: feedbackOutcome.purgedCount > 0,
      purgedCacheCount,
      message: "Не удалось завершить удаление всех связанных данных. Попробуйте повторить удаление позже.",
    };
  }

  // 5. All linked store purges succeeded! Now remove the deletion scope LAST.
  // Snapshot in-memory map in case disk save fails.
  const snapshot = new Map(deletionScopes);

  deletionScopes.delete(lookupKey);
  deletionScopes.delete(scope.lookup_key);
  for (const anon of scope.anonymous_ids) deletionScopes.delete(deriveLookupKey(anon));
  for (const sessLookup of scope.opaque_session_identifiers) deletionScopes.delete(sessLookup);

  const scopeSaveSuccess = saveScopesToDisk(deletionScopes);
  if (!scopeSaveSuccess) {
    console.warn("[Deletion] Failed to persist deletion scope removal to disk.");
    // Restore in-memory scope so that retry with same token will find it
    deletionScopes.clear();
    for (const [k, v] of snapshot.entries()) {
      deletionScopes.set(k, v);
    }
    return {
      status: "error",
      code: "deletion_incomplete",
      retryable: true,
      purgedEventsCount: analyticsOutcome.deletedCount,
      purgedQualitativeRecord: feedbackOutcome.purgedCount > 0,
      purgedCacheCount,
      message: "Не удалось завершить удаление всех связанных данных. Попробуйте повторить удаление позже.",
    };
  }

  // 6. SUCCESS: All applicable required deletions and final scope removal persisted!
  return {
    status: "ok",
    purgedEventsCount: analyticsOutcome.deletedCount,
    purgedQualitativeRecord: feedbackOutcome.purgedCount > 0,
    purgedCacheCount,
    message: "Все связанные данные, сессионный кэш и аналитические события успешно удалены.",
  };
}
