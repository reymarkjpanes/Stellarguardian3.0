/**
 * MFA Enforcement Guard (Phase 3, Issue C7).
 *
 * Checks whether the current user has MFA (AAL2) for mainnet financial operations.
 * Supabase Auth supports TOTP MFA natively — this guard reads the
 * assurance level from the session.
 *
 * Usage in route handlers:
 *   await requireMfaForMainnet(supabase);
 *
 * The guard only enforces on mainnet (STELLAR_NETWORK_MODE=mainnet).
 * Testnet operations always pass without MFA (developer convenience).
 */
import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError } from "@/lib/errors";

/**
 * Require MFA (AAL2) if the platform is in mainnet mode.
 * Throws ForbiddenError (403) with clear instructions if MFA is not satisfied.
 *
 * @param supabase - The authenticated Supabase client (server-side)
 */
export async function requireMfaForMainnet(supabase: SupabaseClient): Promise<void> {
  const networkMode = process.env.STELLAR_NETWORK_MODE ?? "testnet";

  // Testnet: MFA not required
  if (networkMode !== "mainnet") return;

  // Mainnet not enabled: guard is redundant but safe
  if (process.env.STELLAR_MAINNET_ENABLED !== "true") return;

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) {
    throw new ForbiddenError(
      "Unable to verify MFA status. Please re-authenticate and try again.",
    );
  }

  // currentLevel is 'aal1' (password only) or 'aal2' (password + TOTP)
  if (data.currentLevel !== "aal2") {
    throw new ForbiddenError(
      "Multi-factor authentication (MFA) is required for mainnet financial operations. " +
      "Please enable TOTP in Settings and verify your identity.",
    );
  }
}

/**
 * Check if MFA is enrolled (regardless of current session level).
 * Used to show enrollment prompts in the UI.
 */
export async function isMfaEnrolled(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return false;
  return data.totp.length > 0;
}
