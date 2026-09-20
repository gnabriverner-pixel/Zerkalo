import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import {
  calculateCanonicalDigitalCode,
  calculateCanonicalCodeV2,
  purgeCanonicalCaches,
  deriveCacheKey,
  getCalculationCacheKeys,
  getCodeV2CacheKeys,
  resetCanonicalCaches,
  getCanonicalCacheStats,
  setCanonicalCacheCapacity,
} from "./dcsBridge";
import {
  registerDeletionScope,
  executeDataDeletion,
  registerCachePurger,
  getScopesFilePath,
} from "./deletion";
import { HardenedPrivacyCache } from "./cache";

describe("TASK-T2: Privacy Cache Hardening & Memory Lifecycle", () => {
  beforeAll(() => {
    if (!process.env.DELETION_LOOKUP_SECRET || process.env.DELETION_LOOKUP_SECRET.length < 16) {
      process.env.DELETION_LOOKUP_SECRET = "test-deletion-secret-at-least-32-chars-long!";
    }
    registerCachePurger(purgeCanonicalCaches);
  });

  beforeEach(() => {
    resetCanonicalCaches?.();
  });

  afterAll(() => {
    const scopesFile = getScopesFilePath();
    if (scopesFile && fs.existsSync(scopesFile)) {
      try { fs.unlinkSync(scopesFile); } catch {}
    }
  });

  it("1. raw DOB absent from cache key representation and persisted scopes", async () => {
    const RAW_DOB = "12.03.1988";
    const token = "token_raw_dob_check_123456789";

    // Perform calculation
    await calculateCanonicalDigitalCode(RAW_DOB, token);
    await calculateCanonicalCodeV2(RAW_DOB, token);

    // Verify in-memory calculationCache keys
    const calcKeys = getCalculationCacheKeys();
    expect(calcKeys.length).toBeGreaterThanOrEqual(1);
    for (const k of calcKeys) {
      // Must NOT be or contain raw DOB pattern DD.MM.YYYY
      expect(k).not.toBe(RAW_DOB);
      expect(k).not.toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      // Must be 64-char hex string (HMAC-SHA256)
      expect(k).toMatch(/^[a-f0-9]{64}$/);
    }

    // Verify in-memory codeV2Cache keys
    const v2Keys = getCodeV2CacheKeys();
    expect(v2Keys.length).toBeGreaterThanOrEqual(1);
    for (const k of v2Keys) {
      expect(k).not.toBe(RAW_DOB);
      expect(k).not.toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      expect(k).toMatch(/^[a-f0-9]{64}$/);
    }

    // Check disk persisted deletion_scopes.json
    registerDeletionScope(token, { cacheKey: RAW_DOB });
    const scopesFile = getScopesFilePath();
    expect(fs.existsSync(scopesFile)).toBe(true);
    const diskContent = fs.readFileSync(scopesFile, "utf-8");

    // Raw DOB must NOT appear in the JSON content
    expect(diskContent).not.toContain(RAW_DOB);
  });

  it("2. TTL expiry: entries expire and return fresh calculation after TTL", async () => {
    const DOB_TTL = "14.04.1974";
    const calc1 = await calculateCanonicalDigitalCode(DOB_TTL);
    const calc2 = await calculateCanonicalDigitalCode(DOB_TTL);
    expect(calc1).toBe(calc2); // Proves cached

    // Advance time past default TTL (e.g. 3600s + 10s)
    const stats = getCanonicalCacheStats();
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + stats.ttlMs + 5000;

      // After TTL, entry should be expired and return fresh object
      const calcAfterTtl = await calculateCanonicalDigitalCode(DOB_TTL);
      expect(calcAfterTtl).not.toBe(calc1);
      expect(calcAfterTtl.soul).toBe(calc1.soul);
    } finally {
      Date.now = originalNow;
    }
  });

  it("2b. TTL expiry: wall-clock expiry on HardenedPrivacyCache instance", async () => {
    const cache = new HardenedPrivacyCache<string>({ ttlMs: 40 });
    cache.set("k1", "v1");
    expect(cache.get("k1")).toBe("v1");
    expect(cache.has("k1")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cache.get("k1")).toBeUndefined();
    expect(cache.has("k1")).toBe(false);
  });

  it("3. bounded-size eviction: deterministic eviction when capacity is reached", async () => {
    const defaultStats = getCanonicalCacheStats();
    expect(defaultStats.maxEntries).toBe(1000);

    // Set small bounded capacity for testing deterministic LRU eviction
    setCanonicalCacheCapacity(3);

    const dob1 = "01.01.1961";
    const dob2 = "02.02.1962";
    const dob3 = "03.03.1963";
    const dob4 = "04.04.1964";

    await calculateCanonicalDigitalCode(dob1);
    await calculateCanonicalDigitalCode(dob2);
    await calculateCanonicalDigitalCode(dob3);

    const initialKeys = getCalculationCacheKeys();
    expect(initialKeys.length).toBe(3);
    expect(initialKeys).toContain(deriveCacheKey(dob1));
    expect(initialKeys).toContain(deriveCacheKey(dob2));
    expect(initialKeys).toContain(deriveCacheKey(dob3));

    // Access dob1 to make it the most recently used (LRU head)
    // dob2 now becomes the least recently used (LRU tail)
    await calculateCanonicalDigitalCode(dob1);

    // Insert 4th entry; capacity is 3 so the oldest entry (dob2) must be evicted
    await calculateCanonicalDigitalCode(dob4);

    const keysAfter = getCalculationCacheKeys();
    expect(keysAfter.length).toBe(3);
    expect(keysAfter).toContain(deriveCacheKey(dob1)); // refreshed, kept
    expect(keysAfter).not.toContain(deriveCacheKey(dob2)); // evicted by deterministic LRU
    expect(keysAfter).toContain(deriveCacheKey(dob3)); // kept
    expect(keysAfter).toContain(deriveCacheKey(dob4)); // newly inserted

    // Restore standard production capacity
    setCanonicalCacheCapacity(defaultStats.maxEntries);
  });

  it("3b. bounded-size eviction: deterministic LRU eviction when small capacity fills up", () => {
    const cache = new HardenedPrivacyCache<string>({ maxEntries: 2 });
    cache.set("k1", "v1");
    cache.set("k2", "v2");
    expect(cache.size).toBe(2);
    expect(cache.get("k1")).toBe("v1"); // accesses k1, so k2 becomes the oldest
    cache.set("k3", "v3"); // should evict k2
    expect(cache.size).toBe(2);
    expect(cache.get("k1")).toBe("v1");
    expect(cache.get("k2")).toBeUndefined();
    expect(cache.get("k3")).toBe("v3");
  });

  it("4. own-user deletion: valid deletion scope purges user cache entries", async () => {
    const DOB_OWN = "15.05.1975";
    const tokenOwn = "token_own_user_del_123456789";

    const calc1 = await calculateCanonicalDigitalCode(DOB_OWN, tokenOwn);
    const v2_1 = await calculateCanonicalCodeV2(DOB_OWN, tokenOwn);

    registerDeletionScope(tokenOwn, { cacheKey: deriveCacheKey(DOB_OWN) });

    const delRes = await executeDataDeletion(tokenOwn);
    expect(delRes.status).toBe("ok");
    expect(delRes.purgedCacheCount).toBeGreaterThanOrEqual(1);

    // Cache should now produce fresh calculations
    const calc2 = await calculateCanonicalDigitalCode(DOB_OWN);
    const v2_2 = await calculateCanonicalCodeV2(DOB_OWN);
    expect(calc2).not.toBe(calc1);
    expect(v2_2).not.toBe(v2_1);
  });

  it("5. cross-user delete attack: attacker cannot purge victim's cache", async () => {
    const DOB_VICTIM = "16.06.1976";
    const DOB_ATTACKER = "17.07.1977";
    const tokenVictim = "token_victim_cross_123456789";
    const tokenAttacker = "token_attacker_cross_123456789";

    const calcVictim1 = await calculateCanonicalDigitalCode(DOB_VICTIM, tokenVictim);
    const calcAttacker1 = await calculateCanonicalDigitalCode(DOB_ATTACKER, tokenAttacker);

    registerDeletionScope(tokenVictim, { cacheKey: deriveCacheKey(DOB_VICTIM) });
    registerDeletionScope(tokenAttacker, { cacheKey: deriveCacheKey(DOB_ATTACKER) });

    // Attacker attempts deletion
    const delRes = await executeDataDeletion(tokenAttacker);
    expect(delRes.status).toBe("ok");

    // Attacker's cache is purged
    const calcAttacker2 = await calculateCanonicalDigitalCode(DOB_ATTACKER);
    expect(calcAttacker2).not.toBe(calcAttacker1);

    // Victim's cache MUST remain intact
    const calcVictim2 = await calculateCanonicalDigitalCode(DOB_VICTIM, tokenVictim);
    expect(calcVictim2).toBe(calcVictim1);
  });

  it("6. register-session injection attack: client-injected cache keys are ignored", async () => {
    const DOB_VICTIM = "18.08.1978";
    const tokenVictim = "token_victim_inject_123456789";
    const tokenAttacker = "token_attacker_inject_123456789";

    const calcVictim1 = await calculateCanonicalDigitalCode(DOB_VICTIM, tokenVictim);
    registerDeletionScope(tokenVictim, { cacheKey: deriveCacheKey(DOB_VICTIM) });

    // Attack Vector A: Direct unauthorized purge with attacker token
    const victimKey = deriveCacheKey(DOB_VICTIM);
    const unauthorizedPurgeCount = purgeCanonicalCaches(victimKey, [tokenAttacker]);
    expect(unauthorizedPurgeCount).toBe(0);

    // Attack Vector B: Empty or invalid ownerIds cannot bypass ownership
    const emptyOwnerPurgeCount = purgeCanonicalCaches(victimKey, []);
    expect(emptyOwnerPurgeCount).toBe(0);

    // Attack Vector C: Attacker registers session attempting to bind victim's cacheKey
    registerDeletionScope(tokenAttacker, {
      anonymousId: "anon_attacker",
      sessionToken: "session_attacker_12345",
    });

    // Attacker deletes
    await executeDataDeletion(tokenAttacker);

    // Victim's cache MUST remain intact
    const calcVictim2 = await calculateCanonicalDigitalCode(DOB_VICTIM, tokenVictim);
    expect(calcVictim2).toBe(calcVictim1);
  });

  it("6b. injection defence: HardenedPrivacyCache refuses deletion with empty or unauthorized ownerIds", () => {
    const cache = new HardenedPrivacyCache<string>();
    cache.set("key1", "val1", "legitimate_owner");

    // Empty owner list MUST NOT unconditionally purge
    expect(cache.delete("key1", [])).toBe(false);
    expect(cache.get("key1")).toBe("val1");

    // Whitespace only MUST NOT purge
    expect(cache.delete("key1", ["   "])).toBe(false);
    expect(cache.get("key1")).toBe("val1");

    // Foreign owner MUST NOT purge
    expect(cache.delete("key1", ["attacker_owner"])).toBe(false);
    expect(cache.get("key1")).toBe("val1");

    // Legitimate owner MUST purge
    expect(cache.delete("key1", ["legitimate_owner"])).toBe(true);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("7. same-DOB two-session behaviour: safe sharing and independent deletion lifecycle", async () => {
    const DOB_SHARED = "19.09.1979";
    const tokenA = "token_same_dob_session_a_123456789";
    const tokenB = "token_same_dob_session_b_123456789";

    // 1. Session A calculates DOB
    const calcA1 = await calculateCanonicalDigitalCode(DOB_SHARED, tokenA);
    const v2A1 = await calculateCanonicalCodeV2(DOB_SHARED, tokenA);
    registerDeletionScope(tokenA, { cacheKey: deriveCacheKey(DOB_SHARED) });

    // 2. Session B calculates SAME DOB -> Safe cache hit / sharing verified!
    const calcB1 = await calculateCanonicalDigitalCode(DOB_SHARED, tokenB);
    const v2B1 = await calculateCanonicalCodeV2(DOB_SHARED, tokenB);
    expect(calcB1).toBe(calcA1); // Object reference equality: proves safe sharing
    expect(v2B1).toBe(v2A1);
    registerDeletionScope(tokenB, { cacheKey: deriveCacheKey(DOB_SHARED) });

    // 3. Session A calls /api/delete-data
    const delResA = await executeDataDeletion(tokenA);
    expect(delResA.status).toBe("ok");

    // 4. Session B's cache MUST REMAIN INTACT! Deleting Session A does NOT break Session B
    const calcB2 = await calculateCanonicalDigitalCode(DOB_SHARED, tokenB);
    const v2B2 = await calculateCanonicalCodeV2(DOB_SHARED, tokenB);
    expect(calcB2).toBe(calcB1); // Still cached for Session B!
    expect(v2B2).toBe(v2B1);

    // 5. Now Session B calls /api/delete-data
    const delResB = await executeDataDeletion(tokenB);
    expect(delResB.status).toBe("ok");

    // 6. Now that ALL sessions sharing this DOB have deleted, the cache entry MUST BE PURGED
    const calcFresh = await calculateCanonicalDigitalCode(DOB_SHARED);
    const v2Fresh = await calculateCanonicalCodeV2(DOB_SHARED);
    expect(calcFresh).not.toBe(calcB1);
    expect(v2Fresh).not.toBe(v2B1);
  });

  it("8. restart semantics: persisted scopes survive restart, cache repopulates safely with same-DOB isolation", async () => {
    const DOB_RESTART = "20.10.1980";
    const tokenA = "token_restart_user_a_123456789";
    const tokenB = "token_restart_user_b_123456789";

    // 1. User A calculates DOB and registers deletion scope before restart
    const calcA1 = await calculateCanonicalDigitalCode(DOB_RESTART, tokenA);
    registerDeletionScope(tokenA, { cacheKey: deriveCacheKey(DOB_RESTART) });

    // 2. Simulate process restart: wipe in-memory cache, scopes remain on disk
    resetCanonicalCaches?.();
    expect(getCalculationCacheKeys().length).toBe(0);

    // 3. User B (with same DOB) calculates after restart, populating fresh in-memory cache
    const calcB1 = await calculateCanonicalDigitalCode(DOB_RESTART, tokenB);
    expect(calcB1).toBeDefined();
    registerDeletionScope(tokenB, { cacheKey: deriveCacheKey(DOB_RESTART) });

    // 4. User A sends deletion request using pre-restart token (loaded from disk)
    const delResA = await executeDataDeletion(tokenA);
    expect(delResA.status).toBe("ok");

    // 5. User B's cache MUST remain intact: User A cannot wipe post-restart User B's cache
    const calcB2 = await calculateCanonicalDigitalCode(DOB_RESTART, tokenB);
    expect(calcB2).toBe(calcB1);

    // 6. When User B deletes, cache entry is now purged
    const delResB = await executeDataDeletion(tokenB);
    expect(delResB.status).toBe("ok");

    const calcFresh = await calculateCanonicalDigitalCode(DOB_RESTART);
    expect(calcFresh).not.toBe(calcB1);
  });

  it("9. idempotent deletion: repeated deletion requests fail cleanly without corrupting state", async () => {
    const DOB_IDEM = "21.11.1981";
    const token = "token_idempotent_test_123456789";

    await calculateCanonicalDigitalCode(DOB_IDEM, token);
    registerDeletionScope(token, { cacheKey: deriveCacheKey(DOB_IDEM) });

    const first = await executeDataDeletion(token);
    expect(first.status).toBe("ok");

    const second = await executeDataDeletion(token);
    expect(second.status).toBe("error");
    expect(second.code).toBe("deletion_scope_not_found");

    // Direct purge is idempotent
    expect(purgeCanonicalCaches("non_existent_key")).toBe(0);
  });
});
