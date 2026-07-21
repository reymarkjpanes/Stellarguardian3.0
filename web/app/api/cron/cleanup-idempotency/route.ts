/**
 * GET /api/cron/cleanup-idempotency — Idempotency key cleanup cron (Task 3.6).
 *
 * Runs hourly via Vercel Cron (see vercel.json).
 * Deletes all expired idempotency_keys rows.
 * Protected by CRON_SECRET bearer token.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  const supabase = createServiceClient();

  const { error, count } = await supabase
    .from("idempotency_keys")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) {
    logger.error("[cleanup-idempotency] Failed to clean up expired keys", {
      error: error.message,
    });
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  logger.info("[cleanup-idempotency] Cleaned up expired idempotency keys", {
    deletedCount: count ?? 0,
  });

  return NextResponse.json({ data: { deletedCount: count ?? 0 } });
}
