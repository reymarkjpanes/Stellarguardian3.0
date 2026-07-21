/**
 * Wallet management API (H7 — wallet removal protection).
 *
 * DELETE /api/wallets/[public_key] — Remove a wallet with active-escrow safety check.
 * Prevents removal if the wallet is:
 * - A pending prize recipient in any active event
 * - The funding wallet for an active escrow
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleApiError, ForbiddenError, ConflictError, NotFoundError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ public_key: string }> },
) {
  try {
    const { public_key: publicKey } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Verify wallet belongs to this user
    const serviceClient = createServiceClient();
    const { data: wallet } = await serviceClient
      .from("wallets")
      .select("id, user_id, public_key")
      .eq("public_key", publicKey)
      .eq("user_id", user.id)
      .single();

    if (!wallet) throw new NotFoundError("Wallet not found or does not belong to you.");

    // Safety check 1: Is this user a pending prize recipient?
    const { count: pendingWinnerCount } = await serviceClient
      .from("winners")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("disbursement_status", "pending");

    if (pendingWinnerCount && pendingWinnerCount > 0) {
      throw new ConflictError(
        "Cannot remove wallet while you have pending prize disbursements. " +
        `You have ${pendingWinnerCount} pending prize(s) that will be sent to this wallet.`,
      );
    }

    // Safety check 2: Is this wallet the funding_wallet for an active escrow?
    const activeEscrowStates = ["PendingFunding", "PartiallyFunded", "FullyFunded", "Locked", "PendingRelease"];
    const { count: activeEscrowCount } = await serviceClient
      .from("escrow_accounts")
      .select("id", { count: "exact", head: true })
      .eq("funding_wallet", publicKey)
      .in("state", activeEscrowStates);

    if (activeEscrowCount && activeEscrowCount > 0) {
      throw new ConflictError(
        "Cannot remove wallet while it is the funding source for an active escrow. " +
        "Complete or cancel the escrow first.",
      );
    }

    // Safe to delete
    const { error } = await serviceClient
      .from("wallets")
      .delete()
      .eq("id", wallet.id);

    if (error) throw new Error(`Failed to remove wallet: ${error.message}`);

    return okResponse({ deleted: true, publicKey });
  } catch (error) {
    return handleApiError(error);
  }
}
