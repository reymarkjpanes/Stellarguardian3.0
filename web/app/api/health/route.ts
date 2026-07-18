import { NextResponse } from "next/server";

/**
 * Health check endpoint (Req 20.3).
 *
 * Placeholder route handler skeleton. Full readiness semantics
 * (200 when DB active, 503 when unavailable) are implemented in task 18.6.
 */
export async function GET() {
  return NextResponse.json({ data: { status: "ok" } });
}
