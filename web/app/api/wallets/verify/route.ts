/**
 * POST /api/wallets/verify
 *
 * Verifies a wallet challenge-response signature (Req 5.2-5.7).
 * On success, upserts the wallet as Verified in the database.
 *
 * Body: { challengeId: string, signature: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyChallenge } from "@/lib/services/wallet-verifier";
import { handleApiError } from "@/lib/errors";
import { z } from "zod";

const BodySchema = z.object({
  challengeId: z.string().uuid("Invalid challenge ID format."),
  signature: z.string().min(1, "Signature is required."),
  provider: z.string().optional(),
  networkMode: z.enum(["testnet", "mainnet"]).optional(),
});

export async function POST(request: NextRequest) {
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

    const result = await verifyChallenge(
      user.id,
      parsed.data.challengeId,
      parsed.data.signature,
      {
        provider: parsed.data.provider,
        networkMode: parsed.data.networkMode,
      },
    );

    return NextResponse.json({ publicKey: result.publicKey, verified: result.verified });
  } catch (error) {
    return handleApiError(error);
  }
}
