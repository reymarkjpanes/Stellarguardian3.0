/**
 * Versioned public API namespace root (Req 32.1, 32.2).
 *
 * GET /api/v1 — API info / discovery endpoint
 * All /api/v1/** routes use API-key auth with per-key usage tracking.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    data: {
      version: "1.0.0",
      endpoints: [
        { path: "/api/v1/events", methods: ["GET"], description: "List public events" },
        { path: "/api/v1/events/:id", methods: ["GET"], description: "Get event details" },
        { path: "/api/v1/events/:id/verify-escrow", methods: ["GET"], description: "Verify escrow on-chain" },
      ],
      documentation: "https://docs.stellarguardian.io/api/v1",
      rateLimit: { requestsPerHour: 1000 },
    },
  });
}
