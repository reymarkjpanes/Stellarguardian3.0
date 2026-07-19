/**
 * Optimistic Concurrency Control (Req 19.2-19.6).
 *
 * Requires the current version on updates; increments on success; rejects
 * stale writes with 409; returns current version in read responses.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ConflictError } from "@/lib/errors";

/**
 * Perform an optimistic update on a versioned resource.
 *
 * @param supabase - Supabase client (server or service)
 * @param table - Table name
 * @param id - Resource ID
 * @param expectedVersion - The version the caller last read (Req 19.2)
 * @param updates - Partial fields to update (excluding `version`)
 * @returns The updated row including the new version
 */
export async function optimisticUpdate<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  expectedVersion: number,
  updates: Partial<T>,
): Promise<T & { version: number }> {
  // Attempt update only where version matches (Req 19.3)
  const { data, error } = await supabase
    .from(table)
    .update({
      ...updates,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .single();

  if (error) {
    // If no rows matched, the version was stale (Req 19.4)
    if (error.code === "PGRST116" || !data) {
      // Fetch the current version to include in error response
      const { data: current } = await supabase
        .from(table)
        .select("version")
        .eq("id", id)
        .single();

      throw new ConflictError(
        "The resource has been modified since it was last read. Please refresh and try again.",
        {
          expectedVersion,
          currentVersion: current?.version ?? "unknown",
          resource: table,
          resourceId: id,
        },
      );
    }
    throw error;
  }

  if (!data) {
    throw new ConflictError(
      "Stale version — the resource was modified by another request.",
      { expectedVersion, resource: table, resourceId: id },
    );
  }

  return data as T & { version: number };
}

/**
 * Read a versioned resource and return it with its version for the caller
 * to include in subsequent update requests (Req 19.5).
 */
export async function readVersioned<T>(
  supabase: SupabaseClient,
  table: string,
  id: string,
): Promise<(T & { version: number }) | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as T & { version: number };
}
