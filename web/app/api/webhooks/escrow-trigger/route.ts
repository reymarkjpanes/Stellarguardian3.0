/**
 * Webhook: Escrow Automation Trigger (Milestone R3).
 *
 * Triggered via webhook event when an event reaches `PrizeApproved` state.
 * 1. Checks CRON_SECRET / WEBHOOK_SECRET authorization.
 * 2. Parses optional event_id from request body.
 * 3. Verifies zero open/under-review disputes exist.
 * 4. Verifies escrow_accounts.state === 'FullyFunded'.
 * 5. Acquires optimistic lock on events.version updating state to EscrowRelease.
 * 6. Automatically invokes Soroban contract payout functions (lockEscrow, executeSorobanDisbursementBatch, finalizeDisbursement).
 * 7. Records tx_hash into payout_instructions table with idempotency protection.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { executeAutomatedEscrowTrigger } from "@/lib/services/escrow-automation";
import { logger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const POST = withErrorHandling(async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let targetEventId: string | undefined;
  try {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && typeof body.event_id === "string") {
      targetEventId = body.event_id;
    }
  } catch (err) {
    logger.warn("[webhooks/escrow-trigger] Could not parse request body JSON", {
      error: String(err),
    });
  }

  try {
    const result = await executeAutomatedEscrowTrigger(targetEventId);
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[webhooks/escrow-trigger] Error running webhook escrow trigger", {
      error: String(err),
    });
    return NextResponse.json(
      { success: false, error: "Fatal error", details: String(err) },
      { status: 500 },
    );
  }
});
