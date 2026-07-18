/**
 * Browser Supabase client factory (Req 2.1, 3.1, 3.2).
 *
 * For use exclusively in Client Components. Uses the publishable/anon key,
 * so every query issued through this client is subject to Row Level
 * Security — it can never bypass RLS regardless of what the client code
 * requests. Session persistence and automatic token refresh are handled
 * for us by `@supabase/ssr` via `document.cookie`.
 *
 * Per Context7 guidance (`@supabase/ssr`), `createBrowserClient` returns a
 * cached singleton by default, so calling this factory repeatedly across
 * components does not create redundant client instances.
 */
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Create (or retrieve the singleton) Supabase client for use in Client
 * Components. All reads/writes through this client carry the current
 * user's session and are enforced by RLS.
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
