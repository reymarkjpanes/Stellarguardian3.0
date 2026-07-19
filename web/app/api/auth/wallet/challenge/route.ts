/**
 * Wallet challenge issuance endpoint (Req 5.1, 25.9).
 *
 * POST /api/auth/wallet/challenge
 * Body: { publicKey: string }
 * Returns: { data: { challengeId: string, nonce: string } }
 */
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { issueChallenge } from "@/lib/services/wallet-verifier";

const ChallengeRequestSchema = z.object({
  publicKey: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key format"),
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
    const parsed = ChallengeRequestSchema.safeParse(body);

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

    const { challengeId, nonce } = await issueChallenge(user.id, parsed.data.publicKey);

    return okResponse({ challengeId, nonce });
  } catch (error) {
    return handleApiError(error);
  }
}
