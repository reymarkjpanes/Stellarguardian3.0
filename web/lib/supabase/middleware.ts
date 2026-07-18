/**
 * Middleware session-refresh helper (Req 2.1, 3.1, 3.2).
 *
 * Reusable `updateSession`-style helper consumed by the Next.js middleware
 * at the app root (task 6.1). Wired to the request/response cookie jars
 * per Context7 `@supabase/ssr` middleware guidance.
 *
 * CRITICAL (per design.md): `supabase.auth.getClaims()` MUST be called
 * immediately after `createServerClient()` with no intervening code.
 * Inserting code between the two calls, or removing the `getClaims()`
 * call, causes intermittent SSR logouts — the client's internal
 * auth-state listener (which persists refreshed tokens back onto the
 * response cookies via `setAll`) only fires once an auth call has been
 * made on this client instance, and `getClaims()` doubles as the
 * authenticate step of the fixed authenticate -> authorize -> validate ->
 * handle pipeline (Req 3.4). Do not refactor this function to move other
 * logic between the two lines below.
 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { JwtPayload } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export interface UpdateSessionResult {
  /** The response carrying any refreshed session cookies. Return this (or a response derived from it) from middleware. */
  response: NextResponse;
  /** Verified JWT claims for the current request, or `null` if unauthenticated / invalid. */
  claims: JwtPayload | null;
}

/**
 * Refresh the Supabase session for the current request, returning the
 * verified JWT claims (the authenticate step of Req 3.4's pipeline)
 * alongside the `NextResponse` carrying any updated session cookies.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  // MUST be the very next statement after createServerClient() — see the
  // module-level warning above. Do not insert code between these two calls.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
