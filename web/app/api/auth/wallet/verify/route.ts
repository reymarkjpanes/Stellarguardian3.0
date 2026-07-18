import { NextResponse } from "next/server";

/**
 * Wallet challenge-response verification endpoint (Req 5.2, 5.3, 5.4).
 *
 * Placeholder route handler skeleton. Signature verification via
 * `Keypair.verify` is implemented in task 7.2.
 */
export async function POST() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
