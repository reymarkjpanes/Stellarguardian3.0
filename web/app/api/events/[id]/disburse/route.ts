/**
 * Prize disbursement endpoint (Req 8, 13).
 *
 * POST /api/events/[id]/disburse
 * Requires: Idempotency-Key header
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { withIdempotency } from "@/lib/services/idempotency";
import { executeDisbursement } from "@/lib/services/escrow";
import { isDisbursementBlocked } from "@/lib/services/dispute";
import { requireLegalAcceptance } from "@/lib/services/legal";

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

    await requireLegalAcceptance(user.id);

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Idempotency-Key header is required." } },
        { status: 400 },
      );
    }

    // Check if disbursement is blocked by disputes (Req 39.6-39.9)
    const { blocked, reasons } = await isDisbursementBlocked(eventId);
    if (blocked) {
      return Response.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Disbursement is blocked.",
            details: { reasons },
          },
        },
        { status: 403 },
      );
    }

    const result = await withIdempotency(idempotencyKey, user.id, { eventId }, async () => {
      const data = await executeDisbursement(eventId, user.id);
      return { data, status: 200 };
    });

    return okResponse(result.data);
  } catch (error) {
    return handleApiError(error);
  }
}
