import { NextResponse } from "next/server";

/**
 * Prize disbursement endpoint (Req 8, 13 — idempotent financial operation).
 *
 * Placeholder route handler skeleton. Batched disbursement logic is
 * implemented in task 18.3.
 */
export async function POST() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
