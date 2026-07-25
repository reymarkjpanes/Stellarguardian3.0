/**
 * POST /api/stellar/submit — submit a signed XDR transaction to Stellar Testnet.
 *
 * Accepts a Freighter-signed XDR string, submits it via the StellarChainAdapter
 * (server-side Horizon call), and returns the transaction hash + success flag.
 *
 * Using the server-side adapter rather than calling Horizon directly from the
 * browser avoids CORS issues and keeps network configuration centralised.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStellarClient } from "@/lib/stellar/client";

export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can submit transactions
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let signed_xdr: string;
  try {
    const body = await request.json();
    signed_xdr = body.signed_xdr ?? body.signedXdr;
    if (!signed_xdr || typeof signed_xdr !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid signed_xdr field." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const stellar = getStellarClient();
    const result = await stellar.submitSignedTx(signed_xdr);

    return NextResponse.json({
      hash: result.hash,
      successful: result.successful,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transaction submission failed.";
    return NextResponse.json(
      { error: message, successful: false },
      { status: 422 },
    );
  }
}
