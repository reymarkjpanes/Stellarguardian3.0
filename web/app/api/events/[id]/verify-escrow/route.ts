/**
 * Public escrow verification endpoint (Req 4.6).
 *
 * GET /api/events/[id]/verify-escrow
 * Public — no authentication required.
 * Returns on-chain balance and transaction history.
 */
import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { getEscrowVerification } from "@/lib/services/escrow";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const data = await getEscrowVerification(eventId);

    if (!data) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "No escrow account found for this event." } },
        { status: 404 },
      );
    }

    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
