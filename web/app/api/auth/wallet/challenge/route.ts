import { NextResponse } from "next/server";

/**
 * Wallet challenge issuance endpoint (Req 5.1, 25.9).
 *
 * Placeholder route handler skeleton. The 32-byte nonce challenge with
 * 5-minute expiry is implemented in task 7.2.
 */
export async function POST() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
