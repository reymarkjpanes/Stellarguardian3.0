import "server-only";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Cached per-request event fetch — one DB query shared across layout + page.
 * React.cache() deduplicates calls to the SAME function reference within a
 * single server request, so importing this from one shared module is required.
 */
export const getEventById = cache(async (id: string) => {
  const supabase = await createServerClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, state, organizer_id, review_window_hours, prize_pool_target, network_mode, version, category, format, description, registration_deadline",
    )
    .eq("id", id)
    .single();
  return event ?? null;
});
