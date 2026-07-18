import { NextResponse } from "next/server";

/**
 * Escrow refund endpoint (Req 9, 13 — idempotent financial operation).
 *
 * Placeholder route handler skeleton. Refund-to-original-funder logic is
 * implemented in task 18.3.
 */
export async function POST() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
