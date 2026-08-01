/**
 * GET /api/events/[id]/contract-events
 *
 * Returns recent Soroban contract events for an event's escrow.
 * Used by useBlockchainEvents for real-time sync.
 *
 * Query params:
 *   startLedger?: number — ledger to start from (default: last 1000)
 *   limit?:       number — max events to return (default: 50, max: 100)
 *
 * No auth required — contract events are public on-chain data.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getContractEvents } from "@/lib/stellar/soroban-escrow";
import { handleApiError } from "@/lib/errors";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const GET = withErrorHandling(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const url = new URL(request.url);
    const startLedger = url.searchParams.get("startLedger")
      ? Number(url.searchParams.get("startLedger"))
      : undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    // Look up the contract address for this event's escrow.
    // If the event has its own dedicated contract, use that; otherwise fall back to env var.
    const supabase = createServiceClient();
    const { data: escrow } = await supabase
      .from("escrow_accounts")
      .select("contract_address, stellar_public_key")
      .eq("event_id", eventId)
      .maybeSingle();

    if (!escrow) {
      return NextResponse.json({ events: [] });
    }

    // Use the event-specific contract address if available, otherwise env default
    const contractId = escrow.contract_address || undefined;
    const events = await getContractEvents({ contractId, startLedger, limit });

    return NextResponse.json({ events });
  } catch (error) {
    return handleApiError(error);
  }
});
