import { NextResponse } from "next/server";

/**
 * Public on-chain escrow verification endpoint (Req 4.6).
 *
 * Placeholder route handler skeleton. On-chain balance and history lookup
 * is implemented in task 12.5.
 */
export async function GET() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
