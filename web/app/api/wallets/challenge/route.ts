/**
 * POST /api/wallets/challenge
 *
 * Issues a wallet ownership verification challenge (Req 5.1-5.5).
 * Returns a challengeId and nonce for the client to sign.
 *
 * Body: { publicKey: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { issueChallenge } from "@/lib/services/wallet-verifier";
import { handleApiError } from "@/lib/errors";
import { z } from "zod";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const BodySchema = z.object({
  publicKey: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key format."),
});
export const POST = withErrorHandling(async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid request body.",
            details: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 422 },
      );
    }

    const { challengeId, nonce, transaction } = await issueChallenge(
      user.id,
      parsed.data.publicKey,
    );

    return NextResponse.json({ challengeId, nonce, transaction });
  } catch (error) {
    return handleApiError(error);
  }
});
