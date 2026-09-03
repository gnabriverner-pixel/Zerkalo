// Rate Limiter & IP State Retention Management
export const mythRate = new Map<string, { windowStartedAt: number; count: number }>();
export const RATE_LIMIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days max

export function checkAndIncrementRate(
  clientKey: string,
  maxRequests: number = 8,
  nowMs: number = Date.now()
): { allowed: boolean; count: number; retryAfterSec: number } {
  const current = mythRate.get(clientKey);
  if (!current || nowMs - current.windowStartedAt > 10 * 60_000) {
    mythRate.set(clientKey, { windowStartedAt: nowMs, count: 1 });
    return { allowed: true, count: 1, retryAfterSec: 0 };
  }

  if (current.count >= maxRequests) {
    const elapsed = nowMs - current.windowStartedAt;
    const remainingMs = Math.max(0, 10 * 60_000 - elapsed);
    return { allowed: false, count: current.count, retryAfterSec: Math.ceil(remainingMs / 1000) };
  }

  current.count += 1;
  return { allowed: true, count: current.count, retryAfterSec: 0 };
}

export function purgeExpiredRateLimits(nowMs: number = Date.now()): number {
  let count = 0;
  for (const [key, val] of mythRate.entries()) {
    if (nowMs - val.windowStartedAt > 10 * 60_000 || nowMs - val.windowStartedAt > RATE_LIMIT_RETENTION_MS) {
      mythRate.delete(key);
      count++;
    }
  }
  return count;
}
