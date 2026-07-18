/**
 * Supabase environment variable access (Req 2.1, 14.4).
 *
 * Centralizes reading and validating the Supabase-related environment
 * variables so every client factory fails fast with a clear error message
 * instead of passing `undefined` into `@supabase/ssr` / `@supabase/supabase-js`.
 * Secrets are read from `process.env` only — never hard-coded, never
 * bundled into client code (the service-role key is read exclusively from
 * `service.ts`, which is marked server-only).
 */

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        "Copy .env.example to .env.local and provide real Supabase project values.",
    );
  }
  return value;
}

/** Public Supabase project URL. Safe to expose to the browser. */
export function getSupabaseUrl(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/** Public (anon/publishable) key. Safe to expose to the browser; RLS applies. */
export function getSupabaseAnonKey(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Privileged service-role key. NEVER expose to the browser and never import
 * this function outside of server-only code — `service.ts` is the only
 * intended caller.
 */
export function getSupabaseServiceRoleKey(): string {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY");
}
