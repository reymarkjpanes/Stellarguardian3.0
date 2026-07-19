/**
 * Idempotency Service (Req 13.1-13.5).
 *
 * Wraps financial endpoints to prevent double-spend under retries/races.
 * Requires an `Idempotency-Key` header. Uses a DB unique constraint to
 * detect replay vs. conflict.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { BadRequestError, ConflictError } from "@/lib/errors";

/** TTL for idempotency keys in hours (Req 13.3). */
const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Hash a request body to detect same-key-different-body conflicts (Req 13.4).
 */
async function hashBody(body: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(body));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface IdempotencyResult<T> {
  /** If true, the operation was already executed and this is the stored response. */
  isReplay: boolean;
  data: T;
  status: number;
}

/**
 * Execute a financial operation with idempotency protection.
 *
 * @param idempotencyKey - Value from the Idempotency-Key header (Req 13.1)
 * @param userId - The authenticated user's ID
 * @param requestBody - The full request body (for hash comparison)
 * @param operation - The actual operation to execute if this is not a replay
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  userId: string,
  requestBody: unknown,
  operation: () => Promise<{ data: T; status: number }>,
): Promise<IdempotencyResult<T>> {
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    throw new BadRequestError(
      "Idempotency-Key header is required for financial endpoints (Req 13.1).",
    );
  }

  const supabase = createServiceClient();
  const bodyHash = await hashBody(requestBody);
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Attempt to insert the key under a unique constraint (Req 13.5).
  const { data: existing, error: fetchError } = await supabase
    .from("idempotency_keys")
    .select("*")
    .eq("key", idempotencyKey)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Idempotency check failed: ${fetchError.message}`);
  }

  // If key already exists, check for replay vs. conflict
  if (existing) {
    if (existing.request_hash !== bodyHash) {
      // Same key, different body → 409 (Req 13.4)
      throw new ConflictError(
        "Idempotency key has already been used with a different request body.",
        { key: idempotencyKey },
      );
    }
    // Same key, same body → replay stored response (Req 13.2)
    return {
      isReplay: true,
      data: existing.response_body as T,
      status: existing.response_status,
    };
  }

  // Insert the key before executing (Req 13.5 — unique constraint prevents races)
  const { error: insertError } = await supabase.from("idempotency_keys").insert({
    key: idempotencyKey,
    user_id: userId,
    request_hash: bodyHash,
    response_body: null,
    response_status: null,
    expires_at: expiresAt,
  });

  if (insertError) {
    // Unique constraint violation means another request raced us — retry lookup
    if (insertError.code === "23505") {
      const { data: raceWinner } = await supabase
        .from("idempotency_keys")
        .select("*")
        .eq("key", idempotencyKey)
        .eq("user_id", userId)
        .single();

      if (raceWinner?.response_body) {
        return {
          isReplay: true,
          data: raceWinner.response_body as T,
          status: raceWinner.response_status,
        };
      }
      // Operation still in progress by another request — conflict
      throw new ConflictError("Operation is already in progress for this idempotency key.");
    }
    throw new Error(`Idempotency insert failed: ${insertError.message}`);
  }

  // Execute the actual operation
  const result = await operation();

  // Store the response for future replays
  await supabase
    .from("idempotency_keys")
    .update({
      response_body: result.data,
      response_status: result.status,
    })
    .eq("key", idempotencyKey)
    .eq("user_id", userId);

  return {
    isReplay: false,
    data: result.data,
    status: result.status,
  };
}
