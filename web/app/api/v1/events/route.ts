/**
 * Public API v1 — Events listing (Req 32.1, 32.2).
 *
 * GET /api/v1/events — paginated public events with API-key auth
 */
import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/errors/responses";
import { discoverEvents } from "@/lib/services/discovery";
import { createServiceClient } from "@/lib/supabase/service";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

/**
 * Hash an API key using SHA-256 for secure storage comparison.
 * Keys are stored hashed — never in plaintext.
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const GET = withErrorHandling(async function GET(request: NextRequest) {
  try {
    // API key validation (Req 32.2)
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "API key required (x-api-key header)." } },
        { status: 401 },
      );
    }

    // Validate API key against database and track usage (Req 32.2)
    const supabase = createServiceClient();
    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("id, workspace_id, is_active, rate_limit")
      .eq("key_hash", await hashApiKey(apiKey))
      .maybeSingle();

    if (keyError || !keyRecord || !keyRecord.is_active) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Invalid or inactive API key." } },
        { status: 401 },
      );
    }

    // Track usage (non-blocking)
    void supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id)
      .then();

    const url = new URL(request.url);
    const result = await discoverEvents({
      search: url.searchParams.get("search") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      format: url.searchParams.get("format") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      sortBy:
        (url.searchParams.get("sortBy") as "created_at" | "registration_deadline") ?? undefined,
      sortOrder: (url.searchParams.get("sortOrder") as "asc" | "desc") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });

    return paginatedResponse(result.data, result.meta);
  } catch (error) {
    return handleApiError(error);
  }
});
