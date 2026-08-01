/**
 * GET /api/cron — Scheduled job runner.
 * Triggered by Vercel Cron, external scheduler, or manual invocation.
 * Protected by CRON_SECRET header to prevent unauthorized execution.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  cleanupExpiredChallenges,
  enforceDeadlines,
  enforceRetention,
  cleanupIdempotencyRecords,
  enforceReviewWindowExpiry,
} from "@/lib/services/scheduled-jobs";
import { logger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const dynamic = "force-dynamic";
export const GET = withErrorHandling(async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized invocations
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  logger.info("Cron job started");

  const results = await Promise.allSettled([
    cleanupExpiredChallenges(),
    enforceDeadlines(),
    enforceRetention(),
    cleanupIdempotencyRecords(),
    enforceReviewWindowExpiry(),
  ]);

  const summary = {
    challenges_cleaned: results[0].status === "fulfilled" ? results[0].value : 0,
    deadlines_enforced: results[1].status === "fulfilled" ? results[1].value : 0,
    events_archived: results[2].status === "fulfilled" ? results[2].value : 0,
    idempotency_cleaned: results[3].status === "fulfilled" ? results[3].value : 0,
    review_windows_expired: results[4].status === "fulfilled" ? results[4].value : 0,
    errors: results.filter((r) => r.status === "rejected").length,
  };

  logger.info("Cron job completed", summary);

  return NextResponse.json({ data: summary });
});
