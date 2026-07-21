/**
 * Readiness probe — verifies all critical dependencies are reachable.
 * Returns 200 if ready to serve traffic, 503 otherwise.
 *
 * Checks:
 * - Supabase database connectivity
 * - Stellar Horizon reachability (testnet)
 * - Redis (rate limiting) availability
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};

  // --- Supabase DB ---
  const dbStart = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("users").select("id").limit(1).maybeSingle();
    checks.database = { ok: !error, latencyMs: Date.now() - dbStart, error: error?.message };
  } catch (err) {
    checks.database = { ok: false, latencyMs: Date.now() - dbStart, error: String(err) };
  }

  // --- Stellar Horizon ---
  const horizonStart = Date.now();
  try {
    const horizonUrl = process.env.STELLAR_NETWORK_MODE === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";
    const res = await fetch(horizonUrl, { method: "GET", signal: AbortSignal.timeout(5000) });
    checks.stellar = { ok: res.ok, latencyMs: Date.now() - horizonStart };
  } catch (err) {
    checks.stellar = { ok: false, latencyMs: Date.now() - horizonStart, error: String(err) };
  }

  // --- Redis (optional) ---
  const redisStart = Date.now();
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
        signal: AbortSignal.timeout(3000),
      });
      checks.redis = { ok: res.ok, latencyMs: Date.now() - redisStart };
    } catch (err) {
      checks.redis = { ok: false, latencyMs: Date.now() - redisStart, error: String(err) };
    }
  } else {
    checks.redis = { ok: true, latencyMs: 0, error: "Not configured (dev mode)" };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "ready" : "degraded",
      checks,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
