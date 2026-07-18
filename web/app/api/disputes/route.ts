import { NextResponse } from "next/server";

/**
 * Dispute lifecycle endpoint (Req 7, 39).
 *
 * Placeholder route handler skeleton. Dispute creation, role-gated
 * transitions, and the objection window are implemented in task 14.1.
 */
export async function GET() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
