/**
 * Escrow funding endpoint (Req 4, 13).
 *
 * POST /api/events/[id]/fund
 * Requires: Idempotency-Key header
 * Body: { txHash: string, fundingWallet: string }
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { withIdempotency } from "@/lib/services/idempotency";
import { verifyFunding } from "@/lib/services/escrow";
import { requireLegalAcceptance } from "@/lib/services/legal";

const FundRequestSchema = z.object({
  txHash: z.string().min(1, "Transaction hash is required"),
  fundingWallet: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Legal acceptance gate (Req 34.1)
    await requireLegalAcceptance(user.id);

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Idempotency-Key header is required." } },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = FundRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid request body.",
            details: { fieldErrors: z.flattenError(parsed.error).fieldErrors },
          },
        },
        { status: 422 },
      );
    }

    const result = await withIdempotency(idempotencyKey, user.id, body, async () => {
      const data = await verifyFunding(eventId, parsed.data.txHash, user.id, parsed.data.fundingWallet);
      return { data, status: 200 };
    });

    return okResponse(result.data);
  } catch (error) {
    return handleApiError(error);
  }
}
