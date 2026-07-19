/**
 * Escrow refund endpoint (Req 9, 13).
 *
 * POST /api/events/[id]/refund
 * Requires: Idempotency-Key header
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { withIdempotency } from "@/lib/services/idempotency";
import { executeRefund } from "@/lib/services/escrow";
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

    const result = await withIdempotency(idempotencyKey, user.id, { eventId }, async () => {
      const data = await executeRefund(eventId, user.id);
      return { data, status: 200 };
    });

    return okResponse(result.data);
  } catch (error) {
    return handleApiError(error);
  }
}
