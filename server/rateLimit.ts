// Abuse / cost guards for LLM-backed endpoints.
//
// TOPOLOGY (verified against production on 2026-09-19, not assumed):
//   nginx (same host) --proxy_pass http://127.0.0.1:3001--> app
//   app binds loopback only (production.env: HOST=127.0.0.1, PORT=3001)
//   external access to the app port is blocked: iptables INPUT
//     `! -i lo -p tcp --dport 3001 -j DROP`
//   nginx forwards `X-Real-IP $remote_addr` and
//     `X-Forwarded-For $proxy_add_x_forwarded_for` (real client appended last)
// Exactly ONE trusted hop therefore exists: the loopback proxy. server.ts pins
// `app.set('trust proxy', 'loopback')` accordingly. With that setting Express takes
// the rightmost non-trusted address from X-Forwarded-For — i.e. the real client —
// and client-supplied prefixes are never trusted. Without it (previous state) every
// request measured as 127.0.0.1 and all visitors shared ONE global bucket.
//
// These limits are operational safeguards against abuse and runaway cost. They are
// NOT product entitlements: no usage tiers live here, and the defaults leave ordinary
// use untouched (production defaults are conservative, development defaults permissive
// so acceptance tooling keeps working).

import type { RequestHandler } from 'express';

export interface RateBucket {
  windowStartedAt: number;
  count: number;
}

export const DEFAULT_WINDOW_MS = 10 * 60_000;
export const RATE_LIMIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Independent per-endpoint buckets: exhausting one never affects another. */
export const rateBuckets = {
  myth: new Map<string, RateBucket>(),
  meeting: new Map<string, RateBucket>(),
  albert: new Map<string, RateBucket>(),
} as const;

export type RateGuardName = keyof typeof rateBuckets;

export function checkAndIncrementRate(
  clientKey: string,
  maxRequests: number,
  nowMs: number = Date.now(),
  windowMs: number = DEFAULT_WINDOW_MS,
  bucket: Map<string, RateBucket> = rateBuckets.myth
): { allowed: boolean; count: number; retryAfterSec: number } {
  const current = bucket.get(clientKey);

  if (!current || nowMs - current.windowStartedAt >= windowMs) {
    bucket.set(clientKey, { windowStartedAt: nowMs, count: 1 });
    return { allowed: true, count: 1, retryAfterSec: 0 };
  }

  if (current.count >= maxRequests) {
    const remainingMs = Math.max(0, windowMs - (nowMs - current.windowStartedAt));
    return { allowed: false, count: current.count, retryAfterSec: Math.ceil(remainingMs / 1000) };
  }

  current.count += 1;
  return { allowed: true, count: current.count, retryAfterSec: 0 };
}

/** Drops stale client keys so the maps stay bounded on a long-running process. */
export function purgeExpiredRateLimits(
  nowMs: number = Date.now(),
  windowMs: number = DEFAULT_WINDOW_MS
): number {
  const retention = Math.max(windowMs, RATE_LIMIT_RETENTION_MS);
  let removed = 0;
  for (const bucket of Object.values(rateBuckets)) {
    for (const [key, value] of bucket.entries()) {
      if (nowMs - value.windowStartedAt > retention) {
        bucket.delete(key);
        removed += 1;
      }
    }
  }
  return removed;
}

function readPositiveInt(raw: string | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

/**
 * Operational limit resolution: an explicit env value always wins; otherwise a
 * conservative production default and a permissive development default.
 */
export function resolveRateMax(
  envName: string,
  productionDefault: number,
  developmentDefault = 100
): number {
  const configured = readPositiveInt(process.env[envName]);
  if (configured != null) return configured;
  return process.env.NODE_ENV === 'production' ? productionDefault : developmentDefault;
}

export function resolveRateWindowMs(): number {
  const configured = readPositiveInt(process.env.LLM_RATE_WINDOW_MS);
  return configured != null ? configured : DEFAULT_WINDOW_MS;
}

// ---------------------------------------------------------------- daily budget
// Opt-in global ceiling across the expensive generative endpoints (0/absent = off).
// This is a cost circuit-breaker for the operator, not a product quota: it never
// changes what an ordinary user can do unless the operator explicitly enables it.

let budgetDayKey = '';
let budgetUsed = 0;

export function resolveDailyBudgetMax(): number {
  return readPositiveInt(process.env.LLM_DAILY_MAX) ?? 0;
}

export function consumeDailyBudget(
  nowMs: number = Date.now()
): { allowed: boolean; limit: number; used: number } {
  const limit = resolveDailyBudgetMax();
  if (limit <= 0) return { allowed: true, limit: 0, used: 0 };

  const dayKey = new Date(nowMs).toISOString().slice(0, 10);
  if (dayKey !== budgetDayKey) {
    budgetDayKey = dayKey;
    budgetUsed = 0;
  }
  if (budgetUsed >= limit) return { allowed: false, limit, used: budgetUsed };
  budgetUsed += 1;
  return { allowed: true, limit, used: budgetUsed };
}

export interface RateGuardOptions {
  name: RateGuardName;
  maxRequests: number;
  message: string;
  windowMs?: number;
  code?: string;
}

/**
 * Per-client guard middleware. Keys on `req.ip`, which under the verified topology
 * (trust proxy = 'loopback') is the real client address.
 */
export function createRateGuard(options: RateGuardOptions): RequestHandler {
  const { name, maxRequests, message, windowMs = DEFAULT_WINDOW_MS, code = 'rate_limit_exceeded' } = options;
  const bucket = rateBuckets[name];

  return (req, res, next) => {
    const clientKey = req.ip || 'unknown';
    const result = checkAndIncrementRate(clientKey, maxRequests, Date.now(), windowMs, bucket);

    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfterSec));
      return res.status(429).json({
        status: 'error',
        code,
        ui: { safe_message: message },
      });
    }

    const budget = consumeDailyBudget();
    if (!budget.allowed) {
      return res.status(429).json({
        status: 'error',
        code: 'daily_budget_reached',
        ui: {
          safe_message:
            'На сегодня достигнут общий предел генераций. Ваши результаты сохранены — попробуйте завтра.',
        },
      });
    }

    return next();
  };
}
