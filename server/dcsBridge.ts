import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { validateBirthDate } from "../src/services/birthDate";
import type { CalculationResult, CodeV2Payload } from "../src/types";
import {
  HardenedPrivacyCache,
  deriveCacheKey,
  isDobFormat,
} from "./cache";
import { registerCachePurger, registerCacheOwnerBinder } from "./deletion";

export { deriveCacheKey };

const execFileAsync = promisify(execFile);

function getDcsConfig() {
  const forbiddenClone = ["digital-code", "product-journey"].join("-");
  if (process.env.DCS_ROOT && process.env.DCS_ROOT.includes(forbiddenClone)) {
    throw new Error(`[DCS Bridge] Stale DCS clone rejected in DCS_ROOT: "${process.env.DCS_ROOT}". Canonical repo is digital-code-system.`);
  }
  const sibling = path.resolve(process.cwd(), "..", "digital-code-system");
  const canonicalDefault = "/Users/artemkrysin/code/digital-code-system";
  const root = process.env.DCS_ROOT || (fs.existsSync(sibling) ? sibling : (fs.existsSync(canonicalDefault) ? canonicalDefault : ""));
  if (!root || !fs.existsSync(root)) {
    throw new Error(`[DCS Bridge] Canonical DCS root not found at "${root}". Set DCS_ROOT environment variable.`);
  }
  const bridgeScript = path.join(root, "integration", "zerkalo_bridge.py");
  const pythonBin = process.env.PYTHON_BIN || "python3";
  const url = process.env.DCS_BRIDGE_URL || "http://127.0.0.1:39500";
  return { root, bridgeScript, pythonBin, url };
}

export interface CanonicalCalculationResult extends CalculationResult {
  missingNumbers?: number[];
  financialCode?: string;
  tensionScore?: number;
  canonicalAuthority: string;
}

const calculationCache = new HardenedPrivacyCache<CanonicalCalculationResult>({
  name: "calculationCache",
});

function validateDobFormat(dob: string): void {
  const parts = typeof dob === 'string' ? dob.trim().split('.') : [];
  if (parts.length !== 3 || !/^\d{2}\.\d{2}\.\d{4}$/.test(dob.trim()) ||
      !validateBirthDate(parts[0], parts[1], parts[2]).valid) {
    throw new Error('Некорректная дата рождения. Проверьте день, месяц и год.');
  }
}

/**
 * Calculates personality architecture strictly using digital-code-system canonical engine.
 * Authority: digital-code-system/engine.py::full_analysis
 */
export async function calculateCanonicalDigitalCode(dob: string, ownerId?: string): Promise<CanonicalCalculationResult> {
  const trimmed = dob.trim();
  validateDobFormat(trimmed);

  const cacheKey = deriveCacheKey(trimmed);
  const cached = calculationCache.get(cacheKey, ownerId);
  if (cached) {
    return cached;
  }

  let root: string;
  let bridgeScript: string;
  let pythonBin: string;
  let dcsUrl: string;
  try {
    const config = getDcsConfig();
    root = config.root;
    bridgeScript = config.bridgeScript;
    pythonBin = config.pythonBin;
    dcsUrl = config.url;
  } catch (err: any) {
    console.error(`[dcsBridge] DCS configuration failed: ${err?.message}`);
    throw new Error("dcs_canonical_engine_unavailable");
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${dcsUrl}/api/canonical/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dob: trimmed, request_id: `calc_${Date.now()}` }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as any;
      if (data.status === "ok" && data.result) {
        const result: CanonicalCalculationResult = {
          ...data.result,
          canonicalAuthority: "digital-code-system/engine.py::full_analysis",
        };
        calculationCache.set(cacheKey, result, ownerId);
        return result;
      }
    }
  } catch (httpErr: any) {
    // If HTTP loopback service is down, try direct CLI bridge as backup process boundary
    try {
      const { stdout } = await execFileAsync(pythonBin, [bridgeScript, "calculate", "--dob", trimmed], {
        timeout: 8_000,
        env: { ...process.env, PYTHONPATH: root },
      });

      const parsed = JSON.parse(stdout.trim());
      if (parsed && !parsed.error && parsed.soul !== undefined) {
        const result: CanonicalCalculationResult = {
          soul: parsed.soul,
          soulComposite: parsed.soulComposite,
          path: parsed.path,
          pathComposite: parsed.pathComposite,
          direction: parsed.direction,
          directionComposite: parsed.directionComposite,
          expression: parsed.expression,
          expressionComposite: parsed.expressionComposite,
          result: parsed.result,
          resultComposite: parsed.resultComposite,
          baseMatrix: parsed.baseMatrix,
          detailedMatrix: parsed.detailedMatrix,
          missingNumbers: parsed.missingNumbers,
          financialCode: parsed.financialCode,
          tensionScore: parsed.tensionScore,
          canonicalAuthority: "digital-code-system/engine.py::full_analysis",
        };

        calculationCache.set(cacheKey, result, ownerId);
        return result;
      }
    } catch (cliErr: any) {
      // FAIL CLOSED: Never fallback to TS! Never label TS as engine.py!
      console.error(`[dcsBridge] DCS Canonical Engine is unavailable. HTTP err: ${httpErr?.message}, CLI err: ${cliErr?.message}`);
      throw new Error("dcs_canonical_engine_unavailable");
    }
  }

  // FAIL CLOSED
  throw new Error("dcs_canonical_engine_unavailable");
}

function sumDigits(n: number): number {
  let cur = n;
  while (cur > 9) {
    cur = cur.toString().split("").reduce((acc, d) => acc + parseInt(d, 10), 0);
  }
  return cur;
}

function reduceVerbously(num: number): { value: number; composite: string; history: number[] } {
  let current = Math.max(0, Math.round(num) || 0);
  const history: number[] = [current];
  while (current > 9) {
    current = current.toString().split("").reduce((acc, digit) => acc + parseInt(digit, 10), 0);
    history.push(current);
  }
  return { value: current, composite: history.join("/"), history };
}

/**
 * Deterministic in-process implementation of digital-code-system/engine.py::full_analysis.
 * Strictly parity-matched with the python engine.
 */
export function computeCanonicalFallback(dob: string): CanonicalCalculationResult {
  const parts = dob.trim().split(".");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  const digits = dob.replace(/\./g, "").split("").map((d) => parseInt(d, 10)).filter((n) => !isNaN(n));

  const mindFull = day;
  const mindCalc = reduceVerbously(mindFull);

  const actionFull = digits.reduce((a, b) => a + b, 0);
  const actionCalc = reduceVerbously(actionFull);

  const realizationFull = mindFull + actionFull;
  const realizationCalc = reduceVerbously(realizationFull);

  const outcomeFull = mindFull + actionFull + realizationFull;
  const outcomeCalc = reduceVerbously(outcomeFull);

  const dayDigitsSum = parts[0].split("").reduce((acc, d) => acc + parseInt(d, 10), 0);
  const monthDigitsSum = parts[1].split("").reduce((acc, d) => acc + parseInt(d, 10), 0);
  const expressionFull = dayDigitsSum + monthDigitsSum;
  const expressionCalc = reduceVerbously(expressionFull);

  const baseMatrix: Record<string, number> = {
    "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0,
  };
  for (const digit of digits) {
    if (digit >= 1 && digit <= 9) {
      baseMatrix[String(digit)]++;
    }
  }

  const detailedMatrix: Record<string, number> = { ...baseMatrix };
  const extraDigitsStr = `${actionFull}${realizationFull}${outcomeFull}`;
  for (const c of extraDigitsStr) {
    if (c >= "1" && c <= "9") {
      detailedMatrix[c]++;
    }
  }

  const missingNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((i) => baseMatrix[String(i)] === 0);

  const money1 = sumDigits(day);
  const money2 = sumDigits(month);
  const money3 = sumDigits(sumDigits(year));
  const money4 = sumDigits(money1 + money2 + money3);
  const financialCode = `${money1}-${money2}-${money3}-${money4}`;

  return {
    soul: mindCalc.value,
    soulComposite: mindCalc.composite,
    path: actionCalc.value,
    pathComposite: actionCalc.composite,
    direction: realizationCalc.value,
    directionComposite: realizationCalc.composite,
    expression: expressionCalc.value,
    expressionComposite: expressionCalc.composite,
    result: outcomeCalc.value,
    resultComposite: outcomeCalc.composite,
    baseMatrix,
    detailedMatrix,
    missingNumbers,
    financialCode,
    canonicalAuthority: "digital-code-system/engine.py::full_analysis",
  };
}

const codeV2Cache = new HardenedPrivacyCache<CodeV2Payload>({
  name: "codeV2Cache",
});

/**
 * Purges in-memory canonical calculation caches for a given key or DOB.
 * Registered with the central deletion architecture in server/deletion.ts.
 */
export function purgeCanonicalCaches(tokenOrKey: string, ownerIds?: string | string[]): number {
  const trimmed = String(tokenOrKey || "").trim();
  if (!trimmed) return 0;
  const cacheKey = isDobFormat(trimmed) ? deriveCacheKey(trimmed) : trimmed;
  let count = 0;
  if (calculationCache.delete(cacheKey, ownerIds)) count++;
  if (codeV2Cache.delete(cacheKey, ownerIds)) count++;
  return count;
}

/**
 * Binds an owner (e.g. deletion token) to canonical cache entries for a given key or DOB.
 */
export function bindCanonicalCacheOwner(key: string, ownerId: string): void {
  const cleanKey = isDobFormat(key) ? deriveCacheKey(key) : key;
  calculationCache.addOwner(cleanKey, ownerId);
  codeV2Cache.addOwner(cleanKey, ownerId);
}

/**
 * Returns active keys from calculationCache for inspection/adversarial tests.
 */
export function getCalculationCacheKeys(): string[] {
  return calculationCache.keys();
}

/**
 * Returns active keys from codeV2Cache for inspection/adversarial tests.
 */
export function getCodeV2CacheKeys(): string[] {
  return codeV2Cache.keys();
}

/**
 * Clears all canonical caches (useful for test resets).
 */
export function resetCanonicalCaches(): void {
  calculationCache.clear();
  codeV2Cache.clear();
}

/**
 * Returns runtime statistics and limits for the canonical caches.
 */
export function getCanonicalCacheStats(): {
  maxEntries: number;
  ttlMs: number;
  calculationCacheSize: number;
  codeV2CacheSize: number;
} {
  return {
    maxEntries: calculationCache.maxEntries,
    ttlMs: calculationCache.ttlMs,
    calculationCacheSize: calculationCache.size,
    codeV2CacheSize: codeV2Cache.size,
  };
}

/**
 * Dynamically adjusts canonical cache capacity (for testing or runtime tuning).
 */
export function setCanonicalCacheCapacity(limit: number): void {
  calculationCache.setMaxEntries(limit);
  codeV2Cache.setMaxEntries(limit);
}

/**
 * Calculates structured Code V2 payload strictly using DCS canonical engine & V2 library.
 * Authority: digital-code-system/scripts/code_v2_payload.py::assemble_code_v2_payload
 */
export async function calculateCanonicalCodeV2(dob: string, ownerId?: string): Promise<CodeV2Payload> {
  const trimmed = dob.trim();
  validateDobFormat(trimmed);

  const cacheKey = deriveCacheKey(trimmed);
  const cached = codeV2Cache.get(cacheKey, ownerId);
  if (cached) {
    return cached;
  }

  const { root, bridgeScript, pythonBin, url: dcsUrl } = getDcsConfig();

  // 1. Try loopback service first if available
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${dcsUrl}/api/canonical/code-v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dob: trimmed, request_id: `code_v2_${Date.now()}` }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as any;
      if (data.status === "ok" && data.payload) {
        codeV2Cache.set(cacheKey, data.payload, ownerId);
        return data.payload;
      }
    }
  } catch (_httpErr) {
    // Fallthrough to CLI bridge
  }

  // 2. Direct CLI bridge execution (canonical process boundary)
  try {
    const { stdout } = await execFileAsync(pythonBin, [bridgeScript, "code-v2", "--dob", trimmed], {
      timeout: 10_000,
      cwd: root,
      env: { ...process.env, PYTHONPATH: root },
    });

    const parsed = JSON.parse(stdout.trim());
    if (parsed && parsed.status === "ok" && parsed.calculation && parsed.positions) {
      codeV2Cache.set(cacheKey, parsed as CodeV2Payload, ownerId);
      return parsed as CodeV2Payload;
    }
    throw new Error("invalid_dcs_code_v2_payload");
  } catch (cliErr: any) {
    console.error(`[dcsBridge] DCS Canonical Code V2 Engine unavailable:`, cliErr?.message);
    throw new Error("dcs_canonical_code_v2_unavailable");
  }
}

export interface DcsBridgeHealth {
  state: "ready" | "unavailable" | "timeout";
  sha: string;
}

const DCS_HEALTH_TTL_MS = 5_000;
let dcsHealthCache: { at: number; value: DcsBridgeHealth } | null = null;

/**
 * Real availability probe of the DCS bridge service. Briefly cached so public
 * /health polling cannot hammer the bridge. Exposes only state + DCS release
 * SHA; never the internal URL or credentials.
 */
export async function probeDcsBridge(timeoutMs = 1_200): Promise<DcsBridgeHealth> {
  if (dcsHealthCache && Date.now() - dcsHealthCache.at < DCS_HEALTH_TTL_MS) {
    return dcsHealthCache.value;
  }
  const { url } = getDcsConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let value: DcsBridgeHealth;
  try {
    const response = await fetch(`${url}/health`, { signal: controller.signal });
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { sha?: unknown } | null;
      const sha = typeof data?.sha === "string" && data.sha.trim() ? data.sha.trim() : "unknown";
      value = { state: "ready", sha };
    } else {
      value = { state: "unavailable", sha: "unknown" };
    }
  } catch (err: any) {
    value = { state: err?.name === "AbortError" ? "timeout" : "unavailable", sha: "unknown" };
  } finally {
    clearTimeout(timer);
  }
  dcsHealthCache = { at: Date.now(), value };
  return value;
}

// Auto-register canonical caches with the deletion subsystem
registerCachePurger(purgeCanonicalCaches);
registerCacheOwnerBinder(bindCanonicalCacheOwner);


