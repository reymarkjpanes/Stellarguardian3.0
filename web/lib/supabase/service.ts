/**
 * Service-role Supabase client factory (Req 2.1, 3.1, 3.2).
 *
 * Server-only, privileged client authenticated with the Supabase
 * service-role key. This client bypasses Row Level Security entirely, so
 * it must be used exclusively inside audited server services (escrow
 * state transitions, audit record writes, and other privileged
 * transactional operations) — never inside Route Handlers that merely
 * proxy a user request, and never imported into any Client Component.
 *
 * The `server-only` package throws at build/runtime if this module is
 * ever pulled into a client bundle, giving a build-time guardrail in
 * addition to code review discipline.
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * Create a privileged Supabase client using the service-role key. This
 * client has no user session and no RLS enforcement — callers are fully
 * responsible for authorization before invoking it.
 */
export function createServiceClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
