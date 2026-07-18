import { NextResponse } from "next/server";

/**
 * Event escrow funding endpoint (Req 4, 13 — idempotent financial operation).
 *
 * Placeholder route handler skeleton. Idempotency-wrapped funding
 * verification is implemented in task 18.3.
 */
export async function POST() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
