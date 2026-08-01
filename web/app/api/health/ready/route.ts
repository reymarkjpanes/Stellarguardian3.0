/**
 * Readiness probe — deep health check (Phase 5).
 *
 * Verifies connectivity to all critical dependencies:
 * 1. Supabase (database)
 * 2. Stellar Horizon (blockchain network)
 * 3. Upstash Redis (rate limiting, optional)
 *
 * Returns 200 if all critical deps are reachable, 503 if any are down.
 * Used by load balancers and orchestrators to determine routing readiness.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

interface DepCheck {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

export const GET = withErrorHandling(async function GET() {
  const checks: DepCheck[] = [];
  const startAll = Date.now();

  // --- 1. Supabase (critical) ---
  try {
    const start = Date.now();
    const supabase = createServiceClient();
    const { error } = await supabase.from("events").select("id").limit(1);
    const latency = Date.now() - start;

    checks.push({
      name: "supabase",
      status: error ? "down" : "ok",
      latencyMs: latency,
      ...(error && { error: error.message }),
    });
  } catch (err) {
    checks.push({
      name: "supabase",
      status: "down",
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }

  // --- 2. Stellar Horizon (critical for financial ops) ---
  try {
    const start = Date.now();
    const horizonUrl =
      process.env.STELLAR_NETWORK_MODE === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    const res = await fetch(horizonUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;

    checks.push({
      name: "stellar_horizon",
      status: res.ok ? "ok" : "degraded",
      latencyMs: latency,
      ...(!res.ok && { error: `HTTP ${res.status}` }),
    });
  } catch (err) {
    checks.push({
      name: "stellar_horizon",
      status: "degraded", // Degraded, not down — app still works without live blockchain
      error: err instanceof Error ? err.message : "Connection timeout",
    });
  }

  // --- 3. Upstash Redis (non-critical — rate limiting degrades gracefully) ---
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  if (redisUrl) {
    try {
      const start = Date.now();
      const res = await fetch(redisUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN ?? ""}`,
        },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;

      checks.push({
        name: "upstash_redis",
        status: res.ok ? "ok" : "degraded",
        latencyMs: latency,
      });
    } catch {
      checks.push({
        name: "upstash_redis",
        status: "degraded",
        error: "Connection timeout (rate limiting will use fallback)",
      });
    }
  }

  const totalLatency = Date.now() - startAll;
  const hasCriticalFailure = checks.some((c) => c.name === "supabase" && c.status === "down");
  const overallStatus = hasCriticalFailure ? "not_ready" : "ready";

  return NextResponse.json(
    {
      status: overallStatus,
      checks,
      totalLatencyMs: totalLatency,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      timestamp: new Date().toISOString(),
    },
    { status: hasCriticalFailure ? 503 : 200 },
  );
});
