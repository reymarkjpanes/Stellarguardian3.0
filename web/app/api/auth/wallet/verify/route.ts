/**
 * Wallet challenge-response verification endpoint (Req 5.2, 5.3, 5.4).
 *
 * POST /api/auth/wallet/verify
 * Body: { challengeId: string, signature: string }
 * Returns: { data: { publicKey: string, verified: boolean } }
 */
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { verifyChallenge } from "@/lib/services/wallet-verifier";

const VerifyRequestSchema = z.object({
  challengeId: z.string().uuid("Invalid challenge ID format"),
  signature: z.string().min(1, "Signature is required"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = VerifyRequestSchema.safeParse(body);

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

    const result = await verifyChallenge(user.id, parsed.data.challengeId, parsed.data.signature);

    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
