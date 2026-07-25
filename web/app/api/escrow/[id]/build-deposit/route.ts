/**
 * POST /api/escrow/[id]/build-deposit — Build a Soroban deposit transaction.
 *
 * Builds an unsigned (assembled) deposit transaction for the organizer to sign
 * client-side via their wallet extension. Uses the escrow contract's `deposit`
 * function, ensuring funds are tracked within the Soroban contract state.
 *
 * Body: { organizerPublicKey: string, amountStroops: string }
 * Returns: { xdr: string } or { error: { message: string } }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildDepositTransaction } from "@/lib/stellar/soroban-escrow";
import { handleApiError } from "@/lib/errors";
import { z } from "zod";

const BodySchema = z.object({
  organizerPublicKey: z.string().min(56).max(56),
  amountStroops: z.string().regex(/^\d+$/),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: escrowId } = await params;

    // Auth check
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

    // Parse body
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request body.", details: parsed.error.issues } },
        { status: 422 },
      );
    }

    const { organizerPublicKey, amountStroops } = parsed.data;

    // Fetch escrow account to get the contract address
    const serviceClient = createServiceClient();
    const { data: escrow } = await serviceClient
      .from("escrow_accounts")
      .select("id, contract_address, event_id, state")
      .eq("id", escrowId)
      .single();

    if (!escrow) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Escrow account not found." } },
        { status: 404 },
      );
    }

    // Verify escrow is in a fundable state
    const fundableStates = ["Draft", "Funding", "PendingFunding", "PartiallyFunded"];
    if (!fundableStates.includes(escrow.state ?? "")) {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: `Escrow is in state "${escrow.state}" and cannot accept deposits.` } },
        { status: 422 },
      );
    }

    // Build the deposit transaction via the Soroban contract
    const result = await buildDepositTransaction({
      organizerPublicKey,
      amount: BigInt(amountStroops),
      contractId: escrow.contract_address || undefined,
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: { code: "BUILD_FAILED", message: result.error } },
        { status: 422 },
      );
    }

    return NextResponse.json({ xdr: result.xdr });
  } catch (error) {
    return handleApiError(error);
  }
}
