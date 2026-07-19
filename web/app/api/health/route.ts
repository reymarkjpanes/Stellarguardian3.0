/**
 * Health check endpoints (Req 20.3, 20.4).
 *
 * GET /api/health — 200 unauthenticated
 * GET /api/health/ready — 200 when DB active, 503 when unavailable
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  return NextResponse.json({ data: { status: "ok", timestamp: new Date().toISOString() } });
}
