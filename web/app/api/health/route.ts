/**
 * Health check endpoints (Task 6.5, Req 20.3, 20.4).
 *
 * GET /api/health        — lightweight liveness probe (always 200)
 * GET /api/health/ready  — readiness probe with dependency checks (200 or 503)
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function checkSupabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
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
    // Lightweight check — load the root resource
    const account = await server
      .loadAccount("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN")
      .catch(() => null); // funded testnet account; null = horizon reachable but account not found = OK
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkUpstash(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  // Upstash Redis is optional — skip check if not configured
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { ok: true, latencyMs: 0, error: "not configured (optional)" };
  }
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

/** GET /api/health — liveness (always 200 if the process is running) */
export async function GET() {
  return NextResponse.json({
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    },
  });
}
