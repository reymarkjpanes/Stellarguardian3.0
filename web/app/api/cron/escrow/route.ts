/**
 * Cron: Escrow Automation (Milestone R3 / Phase 6, Req 26).
 *
 * Runs periodically via Vercel Cron or manual trigger.
 * 1. Finds events in `PrizeApproved` state with no unresolved disputes.
 * 2. Checks if the escrow is `FullyFunded`.
 * 3. Acquires optimistic DB lock on `events.version` updating state to `EscrowRelease`.
 * 4. Automatically invokes Soroban smart contract payout functions (`lockEscrow`, `executeSorobanDisbursementBatch`, `finalizeDisbursement`).
 * 5. Records Soroban transaction hashes (`tx_hash`) into `payout_instructions` table.
 *
 * Authentication: Requires Bearer CRON_SECRET / WEBHOOK_SECRET in Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { executeAutomatedEscrowTrigger } from "@/lib/services/escrow-automation";
import { logger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const POST = withErrorHandling(async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await executeAutomatedEscrowTrigger();
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[cron/escrow] Fatal error running escrow cron", { error: String(err) });
    return NextResponse.json(
      { success: false, error: "Fatal error", details: String(err) },
      { status: 500 },
    );
  }
});
