/**
 * Supabase environment variable access (Req 2.1, 14.4).
 *
 * Centralizes reading and validating the Supabase-related environment
 * variables. Public (NEXT_PUBLIC_*) vars are inlined by Next.js at build
 * time and are safe for browser access. The service-role key is only
 * available server-side.
 */

/** Public Supabase project URL. Safe to expose to the browser. */
export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error(
      'Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL". ' +
        "Add it to .env.local with your Supabase project URL.",
    );
  }
  return value;
}

/** Public (anon/publishable) key. Safe to expose to the browser; RLS applies. */
export function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error(
      'Missing required environment variable "NEXT_PUBLIC_SUPABASE_ANON_KEY". ' +
        "Add it to .env.local with your Supabase anon key.",
    );
  }
  return value;
}

/**
 * Privileged service-role key. NEVER expose to the browser and never import
 * this function outside of server-only code — `service.ts` is the only
 * intended caller.
 */
export function getSupabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error(
      'Missing required environment variable "SUPABASE_SERVICE_ROLE_KEY". ' +
        "Add it to .env.local with your Supabase service role key.",
    );
  }
  return value;
}
