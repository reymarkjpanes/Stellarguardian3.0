import "server-only";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Cached per-request user fetch — one DB query shared across any server
 * component that needs the current authenticated user within the same request.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

/**
 * Cached per-request wallet fetch for a given user.
 * Returns the first verified wallet for the user, or null.
 */
export const getCurrentUserWallet = cache(async (userId: string) => {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("wallets")
    .select("public_key, network_mode, verification_status")
    .eq("user_id", userId)
    .eq("verification_status", "Verified")
    .limit(1)
    .maybeSingle();
  return data ?? null;
});
