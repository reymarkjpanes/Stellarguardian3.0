/**
 * POST /api/escrow/[id]/build-admin-deposit — Build an admin_deposit Soroban XDR.
 *
 * Used by sponsors to fund an event escrow without being the organizer.
 * The Soroban contract's `admin_deposit` function accepts deposits from any
 * authorized party when the platform admin co-signs.
 *
 * Flow:
 *   1. Server fetches the escrow account and contract address for this escrow ID.
 *   2. Server calls `buildAdminDepositTransaction` which:
 *      - Builds the Soroban `admin_deposit(from, amount)` call
 *      - Simulates to get auth + footprint
 *      - Pre-signs with platform admin key
 *   3. Returns partially-signed XDR for the sponsor wallet to add their signature.
 *   4. Sponsor submits via POST /api/stellar/submit.
 *
 * Security:
 *   - Requires authenticated user
 *   - Requires user to be a Sponsor on this event (or Organizer)
 *   - Validates escrow is in a fundable state
 *   - Uses PLATFORM_ADMIN_SECRET server-only env var — never exposed to client
 *
 * Body: { sponsorPublicKey: string, amountStroops: string }
 * Returns: { xdr: string } or { error: { code, message } }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildAdminDepositTransaction } from "@/lib/stellar/soroban-escrow";
import { withErrorHandling } from "@/lib/errors/with-error-handling";
import { z } from "zod";

const BodySchema = z.object({
  sponsorPublicKey: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key format"),
  amountStroops: z
    .string()
    .regex(/^\d+$/, "amountStroops must be a non-negative integer string"),
});

export const POST = withErrorHandling(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: escrowId } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
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

  // ── Parse body ────────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body.", details: parsed.error.issues } },
      { status: 422 },
    );
  }

  const { sponsorPublicKey, amountStroops } = parsed.data;
  const amountBigInt = BigInt(amountStroops);

  if (amountBigInt <= BigInt(0)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Deposit amount must be greater than 0." } },
      { status: 422 },
    );
  }

  // ── Fetch escrow account ─────────────────────────────────────────────────
  const serviceClient = createServiceClient();
  const { data: escrow } = await serviceClient
    .from("escrow_accounts")
    .select("id, contract_address, event_id, status, expected_balance")
    .eq("id", escrowId)
    .single();

  if (!escrow) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Escrow account not found." } },
      { status: 404 },
    );
  }

  // ── Verify role — must be Sponsor or Organizer on this event ─────────────
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", escrow.event_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const allowedRoles = new Set(["Sponsor", "Organizer", "WorkspaceAdmin", "WorkspaceOwner"]);
  if (!membership || !allowedRoles.has(membership.role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only sponsors and organizers can fund the escrow." } },
      { status: 403 },
    );
  }

  // ── Verify escrow is in a fundable state ─────────────────────────────────
  const fundableStatuses = ["PendingFunding", "PartiallyFunded"];
  const currentStatus = (escrow.status as string) ?? "";
  if (!fundableStatuses.includes(currentStatus)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_STATE",
          message: `Escrow is in status "${currentStatus}" and cannot accept additional deposits.`,
        },
      },
      { status: 422 },
    );
  }

  // ── Require platform admin secret ────────────────────────────────────────
  const platformSecret = process.env.PLATFORM_ADMIN_SECRET ?? process.env.STELLAR_ESCROW_SECRET;
  if (!platformSecret) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Platform admin key not configured. Contact support.",
        },
      },
      { status: 503 },
    );
  }

  // ── Build admin_deposit XDR (pre-signed with platform key) ───────────────
  const result = await buildAdminDepositTransaction({
    fromPublicKey: sponsorPublicKey,
    amount: amountBigInt,
    platformSecretKey: platformSecret,
    contractId: escrow.contract_address || undefined,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: { code: "BUILD_FAILED", message: result.error } },
      { status: 422 },
    );
  }

  return NextResponse.json({
    xdr: result.xdr,
    escrowId,
    eventId: escrow.event_id,
    amountStroops,
    expectedBalance: escrow.expected_balance,
  });
});
