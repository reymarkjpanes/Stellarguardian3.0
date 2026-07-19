/**
 * Public API v1 — Events listing (Req 32.1, 32.2).
 *
 * GET /api/v1/events — paginated public events with API-key auth
 */
import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/errors/responses";
import { discoverEvents } from "@/lib/services/discovery";

export async function GET(request: NextRequest) {
  try {
    // API key validation (Req 32.2)
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "API key required (x-api-key header)." } },
        { status: 401 },
      );
    }

    // TODO: Validate API key against database and track usage
    // For now, accept any non-empty key for development

    const url = new URL(request.url);
    const result = await discoverEvents({
      search: url.searchParams.get("search") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      format: url.searchParams.get("format") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      sortBy: (url.searchParams.get("sortBy") as "created_at" | "registration_deadline") ?? undefined,
      sortOrder: (url.searchParams.get("sortOrder") as "asc" | "desc") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });

    return paginatedResponse(result.data, result.meta);
  } catch (error) {
    return handleApiError(error);
  }
}
