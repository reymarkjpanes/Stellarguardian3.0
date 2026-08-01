/**
 * Cron: Escrow reconciliation (ADR-001, Req 26.4-26.7).
 *
 * Runs every 30 minutes. For each active escrow account, compares:
 * 1. On-chain Horizon balance vs DB expected_balance
 * 2. Soroban contract state vs DB escrow state
 *
 * Sets `inconsistent = true` on divergence, blocking automated transitions.
 * Alerts organizers via notification.
 *
 * Authentication: Requires Bearer CRON_SECRET in Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCronAuth } from "@/lib/cron-auth";
import { VerificationService } from "@/lib/services/escrow/verification.service";
import { logger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const ACTIVE_ESCROW_STATES = [
  "PendingFunding",
  "PartiallyFunded",
  "FullyFunded",
  "Locked",
  "PendingRelease",
];
export const POST = withErrorHandling(async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const results: Array<{ eventId: string; consistent: boolean }> = [];
  let errors = 0;

  // Fetch all active escrow accounts
  const { data: escrows } = await supabase
    .from("escrow_accounts")
    .select("event_id")
    .in("state", ACTIVE_ESCROW_STATES);

  for (const escrow of escrows ?? []) {
    try {
      const result = await VerificationService.reconcileEscrow(escrow.event_id);
      results.push({ eventId: escrow.event_id, consistent: result.consistent });
    } catch (err) {
      logger.error("[cron/reconcile] Failed to reconcile escrow", {
        eventId: escrow.event_id,
        error: String(err),
      });
      errors++;
    }
  }

  const inconsistentCount = results.filter((r) => !r.consistent).length;

  return NextResponse.json({
    success: true,
    total: results.length,
    consistent: results.length - inconsistentCount,
    inconsistent: inconsistentCount,
    errors,
    timestamp: new Date().toISOString(),
  });
});
