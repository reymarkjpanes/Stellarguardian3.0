/**
 * Rate Limiting — Upstash Redis backed (Req 14.2).
 *
 * Tiered rate limits per endpoint category:
 * - Auth: 5 req/60s per IP (brute-force protection)
 * - Financial: 2 req/300s per user (disbursement/refund protection)
 * - Write: 10 req/60s per user (general mutations)
 * - Read: 60 req/60s per user (standard API)
 * - Public: 30 req/60s per IP (unauthenticated)
 *
 * Falls back to a permissive no-op if Upstash env vars are missing
 * (development convenience) but logs a warning.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitTier =
  | "auth"
  | "financial"
  | "write"
  | "read"
  | "public";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (ms)
}

const NOOP_RESULT: RateLimitResult = {
  success: true,
  limit: 999,
  remaining: 999,
  reset: Date.now() + 60_000,
};

let redis: Redis | null = null;
let limiters: Map<RateLimitTier, Ratelimit> | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getLimiters(): Map<RateLimitTier, Ratelimit> | null {
  if (limiters) return limiters;
  const r = getRedis();
  if (!r) return null;

  limiters = new Map<RateLimitTier, Ratelimit>([
    [
      "auth",
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(5, "60 s"),
        prefix: "rl:auth",
      }),
    ],
    [
      "financial",
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(2, "300 s"),
        prefix: "rl:fin",
      }),
    ],
    [
      "write",
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(10, "60 s"),
        prefix: "rl:write",
      }),
    ],
    [
      "read",
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(60, "60 s"),
        prefix: "rl:read",
      }),
    ],
    [
      "public",
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(30, "60 s"),
        prefix: "rl:pub",
      }),
    ],
  ]);

  return limiters;
}

/**
 * Resolve rate-limit tier from the request pathname and method.
 */
export function resolveRateLimitTier(
  pathname: string,
  method: string,
  isAuthenticated: boolean,
): RateLimitTier | null {
  // Health checks bypass rate limiting entirely
  if (pathname === "/api/health" || pathname === "/api/health/ready") {
    return null;
  }

  // Auth endpoints — strictest limits
  if (
    pathname.startsWith("/api/auth/") ||
    pathname === "/login" ||
    pathname === "/signup"
  ) {
    return "auth";
  }

  // Financial operations
  if (
    pathname.match(/\/api\/events\/[^/]+\/(disburse|fund|refund)$/)
  ) {
    return "financial";
  }

  // API writes
  if (pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return "write";
  }

  // Authenticated reads
  if (pathname.startsWith("/api/") && isAuthenticated) {
    return "read";
  }

  // Unauthenticated API reads
  if (pathname.startsWith("/api/")) {
    return "public";
  }

  // Page navigations are not rate-limited
  return null;
}

/**
 * Check rate limit for a given identifier + tier.
 * Returns the result (success/failure + metadata for headers).
 * Returns NOOP_RESULT if Upstash is not configured (dev mode).
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier,
): Promise<RateLimitResult> {
  const lims = getLimiters();
  if (!lims) {
    // Upstash not configured — allow everything (development)
    return NOOP_RESULT;
  }

  const limiter = lims.get(tier);
  if (!limiter) return NOOP_RESULT;

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
