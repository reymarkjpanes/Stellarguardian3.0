/**
 * Readiness check (Req 20.3, 20.4).
 *
 * GET /api/health/ready — 200 when DB active, 503 when unavailable
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    // Simple query to verify DB connectivity
    const { error } = await supabase.from("users").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database is not reachable.",
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      data: { status: "ready", timestamp: new Date().toISOString() },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The service is temporarily unavailable.",
        },
      },
      { status: 503 },
    );
  }
}
