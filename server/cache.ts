import crypto from "crypto";

export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
  lastAccessedAt: number;
  owners: Set<string>;
}

export interface CacheOptions {
  maxEntries?: number;
  ttlMs?: number;
  name?: string;
}

export function getCacheSecret(): string {
  const secret = process.env.DELETION_LOOKUP_SECRET;
  if (secret && secret.trim().length >= 16) {
    return secret.trim();
  }
  // Safe fallback for testing environment if not explicitly set
  if (process.env.NODE_ENV !== "production") {
    return "test-deletion-secret-at-least-32-chars-long!";
  }
  throw new Error("CRITICAL: DELETION_LOOKUP_SECRET is required and must be at least 16 characters");
}

export function deriveCacheKey(dob: string, namespace = "canonical_calc"): string {
  const secret = getCacheSecret();
  const normalized = String(dob || "").trim();
  return crypto.createHmac("sha256", secret).update(`${namespace}:${normalized}`).digest("hex");
}

export function deriveOwnerLookupKey(tokenOrSession: string): string {
  const secret = getCacheSecret();
  const normalized = String(tokenOrSession || "").trim();
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

export function isDobFormat(val: unknown): boolean {
  return typeof val === "string" && /^\d{2}\.\d{2}\.\d{4}$/.test(val.trim());
}

/**
 * Hardened in-memory privacy cache with:
 * - Opaque keyed HMAC identity (zero raw DOB in memory keys or disk scopes)
 * - Strict per-entry TTL
 * - Bounded capacity with deterministic LRU eviction
 * - Multi-owner reference tracking for safe same-DOB sharing without cross-session deletion leakage
 */
export class HardenedPrivacyCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  readonly maxEntries: number;
  readonly ttlMs: number;
  readonly name: string;

  constructor(options?: CacheOptions) {
    const envMax = parseInt(process.env.CACHE_MAX_ENTRIES || "", 10);
    this.maxEntries = options?.maxEntries || (Number.isFinite(envMax) && envMax > 0 ? envMax : 1000);

    const envTtl = parseInt(process.env.CACHE_TTL_MS || "", 10);
    this.ttlMs = options?.ttlMs || (Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 3_600_000); // 1 hour default

    this.name = options?.name || "cache";
  }

  get(key: string, ownerId?: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    entry.lastAccessedAt = Date.now();
    if (ownerId && typeof ownerId === "string" && ownerId.trim().length > 0) {
      entry.owners.add(deriveOwnerLookupKey(ownerId));
    }

    // Maintain LRU access order in Map
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ownerId?: string): void {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing) {
      existing.value = value;
      existing.expiresAt = now + this.ttlMs;
      existing.lastAccessedAt = now;
      if (ownerId && typeof ownerId === "string" && ownerId.trim().length > 0) {
        existing.owners.add(deriveOwnerLookupKey(ownerId));
      }
      this.store.delete(key);
      this.store.set(key, existing);
      return;
    }

    // Bounded capacity check: deterministic eviction of oldest entry
    if (this.store.size >= this.maxEntries) {
      this.pruneExpired();
    }
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }

    const owners = new Set<string>();
    if (ownerId && typeof ownerId === "string" && ownerId.trim().length > 0) {
      owners.add(deriveOwnerLookupKey(ownerId));
    }

    this.store.set(key, {
      key,
      value,
      expiresAt: now + this.ttlMs,
      lastAccessedAt: now,
      owners,
    });
  }

  addOwner(key: string, ownerId: string): void {
    const entry = this.store.get(key);
    const cleanOwner = String(ownerId || "").trim();
    if (entry && cleanOwner) {
      entry.owners.add(deriveOwnerLookupKey(cleanOwner));
    }
  }

  delete(key: string, ownerIds?: string | string[]): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    // If ownerId(s) specified
    if (ownerIds) {
      const ids = Array.isArray(ownerIds) ? ownerIds : [ownerIds];
      const validIds = ids.map((id) => String(id || "").trim()).filter(Boolean);
      if (validIds.length === 0) {
        this.store.delete(key);
        return true;
      }

      // If entry was created anonymously (no owners registered)
      if (entry.owners.size === 0) {
        this.store.delete(key);
        return true;
      }

      let found = false;
      for (const rawId of validIds) {
        const normId = deriveOwnerLookupKey(rawId);
        if (entry.owners.has(normId)) {
          entry.owners.delete(normId);
          found = true;
        } else if (entry.owners.has(rawId)) {
          entry.owners.delete(rawId);
          found = true;
        }
      }

      // If none of the ownerIds matched this entry's owners, this user does NOT own this entry
      if (!found) {
        return false;
      }

      // If other owners still active on this entry:
      if (entry.owners.size > 0) {
        // Safe sharing preserved: entry retained for remaining active users
        return true;
      }

      // If entry now has 0 owners:
      this.store.delete(key);
      return true;
    }

    // Unconditional deletion (e.g. direct admin/test purge without owner context)
    this.store.delete(key);
    return true;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  pruneExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [k, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(k);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  getOwners(key: string): string[] {
    const entry = this.store.get(key);
    return entry ? Array.from(entry.owners) : [];
  }
}
