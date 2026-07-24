/**
 * DELETE /api/wallets/[public_key] — Remove a wallet with escrow protection (H7).
 *
 * Before deleting, checks:
 * 1. Wallet is not a pending winner destination in any active event
 * 2. Wallet is not the funding_wallet on any active escrow
 *
 * Returns 409 Conflict if the wallet has active dependencies.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ public_key: string }> },
) {
  const { public_key: publicKey } = await params;

  // Authenticate the user
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const serviceClient = createServiceClient();

  // Verify the wallet belongs to this user
  const { data: wallet } = await serviceClient
    .from("wallets")
    .select("id, user_id, public_key")
    .eq("public_key", publicKey)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Wallet not found or does not belong to you." } },
      { status: 404 },
    );
  }

  // --- Check 1: Is this wallet a pending winner destination? ---
  const { count: pendingWinnerCount } = await serviceClient
    .from("winners")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("disbursement_status", "pending");

  if (pendingWinnerCount && pendingWinnerCount > 0) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message:
            "Cannot remove this wallet while you have pending prize disbursements. Complete or withdraw from active events first.",
          details: { pendingWinnerCount },
        },
      },
      { status: 409 },
    );
  }

  // --- Check 2: Is this wallet the funding_wallet on any active escrow? ---
  const ACTIVE_ESCROW_STATES = [
    "PendingFunding",
    "PartiallyFunded",
    "FullyFunded",
    "Locked",
    "PendingRelease",
  ];

  const { count: activeEscrowCount } = await serviceClient
    .from("escrow_accounts")
    .select("id", { count: "exact", head: true })
    .eq("funding_wallet", publicKey)
    .in("state", ACTIVE_ESCROW_STATES);

  if (activeEscrowCount && activeEscrowCount > 0) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message:
            "Cannot remove this wallet while it is the funding source for an active escrow. Wait for the event to complete or be cancelled.",
          details: { activeEscrowCount },
        },
      },
      { status: 409 },
    );
  }

  // --- All checks passed — remove the wallet ---
  const { error: deleteError } = await serviceClient
    .from("wallets")
    .delete()
    .eq("id", wallet.id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to remove wallet." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, message: "Wallet removed successfully." });
}
