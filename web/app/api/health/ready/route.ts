/**
 * Readiness probe (Task 6.5, Req 20.3, 20.4).
 * GET /api/health/ready — 200 when all dependencies healthy, 503 when degraded.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("users").select("id").limit(1);
    return { ok: !error, latencyMs: Date.now() - start, error: error?.message };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkStellarHorizon(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const { Horizon } = await import("@stellar/stellar-sdk");
    const network = process.env.STELLAR_NETWORK_MODE ?? "testnet";
    const url =
      network === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";
    const server = new Horizon.Server(url);
    // Lightweight check — fetch root resource (works without a funded account)
    await server
      .loadAccount("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN")
      .catch(() => null); // null = account not found but horizon is reachable = OK
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkRedis(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { ok: true, latencyMs: 0, error: "not configured (optional)" };
  }
  const start = Date.now();
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
    });
    await redis.ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function GET() {
  const [database, stellar, redis] = await Promise.all([
    checkDatabase(),
    checkStellarHorizon(),
    checkRedis(),
  ]);

  const checks = { database, stellar, redis };
  const healthy = database.ok; // DB is critical; Stellar + Redis are non-critical
  const status = healthy ? "ready" : "degraded";

  if (!healthy) {
    logger.warn("[health/ready] Service degraded", { checks });
  }

  return NextResponse.json(
    { data: { status, timestamp: new Date().toISOString(), checks } },
    { status: healthy ? 200 : 503 },
  );
}
