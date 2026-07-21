/**
 * Cron job authentication (Req 14.2, Security Issue 1.9).
 *
 * Verifies the Authorization header matches the CRON_SECRET env var.
 * Used by all /api/cron/* routes to prevent unauthorized execution.
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";

/**
 * Verify the cron request has a valid secret.
 * Returns null if authenticated, or an error Response if not.
 */
export function verifyCronAuth(request: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "MISCONFIGURED", message: "CRON_SECRET not configured." } },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== secret) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  return null; // Authenticated
}
