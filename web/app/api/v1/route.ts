import { NextResponse } from "next/server";

/**
 * Versioned public API namespace root (Req 32.2).
 *
 * Placeholder route handler skeleton. API-key auth, per-key usage
 * tracking, and versioned sub-resources are implemented in task 17.1.
 */
export async function GET() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
