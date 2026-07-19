/**
 * Event Discovery and Search Service (Req 37.1-37.5).
 *
 * Returns only public non-terminal events matching filters with full-text
 * search, ordered by selected sort key, using the GIN full-text index.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export interface DiscoveryFilters {
  search?: string;
  category?: string;
  format?: string;
  tag?: string;
  fundingStatus?: "funded" | "unfunded" | "partial";
  sortBy?: "created_at" | "registration_deadline" | "prize_pool_target" | "title";
  sortOrder?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

/** States excluded from public discovery (Req 37.1). */
const EXCLUDED_STATES = ["Draft", "Cancelled"];

export async function discoverEvents(filters: DiscoveryFilters) {
  const supabase = createServiceClient();
  const limit = Math.min(filters.limit ?? 20, 50);

  let query = supabase
    .from("events")
    .select("id, title, description, tags, category, format, state, prize_pool_target, registration_deadline, network_mode, created_at", { count: "exact" })
    .not("state", "in", `(${EXCLUDED_STATES.join(",")})`)
    .order(filters.sortBy ?? "created_at", { ascending: filters.sortOrder === "asc" })
    .limit(limit);

  // Full-text search (Req 37.1)
  if (filters.search) {
    query = query.textSearch(
      "title",
      filters.search,
      { type: "websearch", config: "english" },
    );
  }

  // Category filter
  if (filters.category) query = query.eq("category", filters.category);

  // Format filter
  if (filters.format) query = query.eq("format", filters.format);

  // Tag filter
  if (filters.tag) query = query.contains("tags", [filters.tag]);

  // Cursor-based pagination
  if (filters.cursor) {
    const sortField = filters.sortBy ?? "created_at";
    if (filters.sortOrder === "asc") {
      query = query.gt(sortField, filters.cursor);
    } else {
      query = query.lt(sortField, filters.cursor);
    }
  }

  const { data, error, count } = await query;

  if (error) throw new Error(`Discovery query failed: ${error.message}`);

  const events = data ?? [];
  const hasMore = events.length === limit;
  const sortField = filters.sortBy ?? "created_at";
  const nextCursor = hasMore
    ? String(events[events.length - 1]?.[sortField as keyof typeof events[0]] ?? "")
    : null;

  return {
    data: events,
    meta: {
      cursor: nextCursor,
      hasMore,
      total: count ?? 0,
    },
  };
}
