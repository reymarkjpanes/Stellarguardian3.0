/**
 * POST /api/cron/cleanup-idempotency — Idempotency key cleanup cron (Task 3.6).
 *
 * Runs hourly via Vercel Cron (see vercel.json).
 * Deletes all expired idempotency_keys rows.
 * Protected by CRON_SECRET bearer token via verifyCronAuth.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const dynamic = "force-dynamic";
// Keep GET handler for backward compatibility with existing Vercel cron config
export const GET = withErrorHandling(async function GET(request: NextRequest) {
  return POST(request);
});
export const POST = withErrorHandling(async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

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

  return NextResponse.json({
    success: true,
    deletedCount: count ?? 0,
    timestamp: new Date().toISOString(),
  });
});
