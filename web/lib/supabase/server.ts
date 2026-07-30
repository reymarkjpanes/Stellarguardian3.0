/**
 * Server Supabase client factory (Req 2.1, 3.1, 3.2).
 *
 * For use in Server Components, Route Handlers, and Server Actions. Wired
 * to `next/headers` cookies (per Context7 `@supabase/ssr` guidance),
 * carrying the current user's JWT so every query is subject to Row Level
 * Security exactly as if it came from the browser client.
 *
 * `cookies()` is async as of Next.js 15+ (confirmed via Context7 Next.js
 * docs for the version used by this app), so this factory is async and
 * callers MUST `await createServerClient()`.
 *
 * Server Components cannot write cookies (Next.js throws if a Server
 * Component attempts to `set`/`delete`) — only Route Handlers and Server
 * Actions can. Per Context7, `@supabase/ssr` handles this gracefully on
 * its own (it logs a warning and no-ops) rather than throwing, so no
 * try/catch is required around `setAll` here. Route Handlers and Server
 * Actions get full cookie write support since `next/headers`'s cookie
 * store is mutable in those contexts.
 */
import "server-only";

import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Create a request-scoped Supabase client for Server Components, Route
 * Handlers, and Server Actions. Must be awaited.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored since middleware is handling session refreshes.
        }
      },
    },
  });
}
