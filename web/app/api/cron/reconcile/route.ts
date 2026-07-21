/**
 * GET /api/cron/reconcile — Periodic escrow balance reconciliation (Task 3.3).
 *
 * Runs every 15 minutes via Vercel Cron (see vercel.json).
 * For each active (non-terminal) escrow account, calls VerificationService.reconcileEscrow().
 * Inconsistencies are flagged and the organizer is notified by the service.
 *
 * Protected by CRON_SECRET bearer token.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { VerificationService } from "@/lib/services/escrow/verification.service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Escrow states that are non-terminal and require ongoing reconciliation. */
const ACTIVE_STATES = [
  "PendingFunding",
  "PartiallyFunded",
  "FullyFunded",
  "Locked",
  "PendingRelease",
];

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
  const startedAt = Date.now();

  // Fetch all active escrow accounts
  const { data: escrows, error } = await supabase
    .from("escrow_accounts")
    .select("id, event_id, state")
    .in("state", ACTIVE_STATES);

  if (error) {
    logger.error("[reconcile-cron] Failed to fetch escrow accounts", { error: error.message });
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  let checked = 0;
  let inconsistent = 0;
  let failed = 0;

  for (const escrow of escrows ?? []) {
    try {
      const result = await VerificationService.reconcileEscrow(escrow.event_id);
      checked++;
      if (!result.consistent) inconsistent++;
    } catch (err) {
      logger.error("[reconcile-cron] Reconciliation failed", {
        escrowId: escrow.id,
        eventId: escrow.event_id,
        error: String(err),
      });
      failed++;
    }
  }

  const durationMs = Date.now() - startedAt;

  logger.info("[reconcile-cron] Complete", { checked, inconsistent, failed, durationMs });

  return NextResponse.json({
    data: { checked, inconsistent, failed, durationMs },
  });
}
