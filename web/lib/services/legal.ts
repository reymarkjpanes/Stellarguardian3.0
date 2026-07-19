/**
 * Legal Acceptance, Disclaimers, and Mainnet/KYC Gating (Req 34.1-34.5).
 *
 * Blocks create/fund actions unless the user has accepted current-version
 * Terms and Custody Disclosure. Requires re-acceptance after updates.
 * Gates mainnet operations and identity verification.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { ForbiddenError } from "@/lib/errors";

/** Current version of the Terms of Service document. */
const CURRENT_TERMS_VERSION = "1.0.0";

/** Current version of the Custody Disclosure document. */
const CURRENT_CUSTODY_VERSION = "1.0.0";

/**
 * Check if a user has accepted the current versions of required legal docs (Req 34.1).
 */
export async function hasCurrentLegalAcceptance(userId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("legal_acceptances")
    .select("document_type, version")
    .eq("user_id", userId);

  if (!data) return false;

  const acceptedVersions = new Map(
    data.map((d) => [d.document_type, d.version]),
  );

  return (
    acceptedVersions.get("terms") === CURRENT_TERMS_VERSION &&
    acceptedVersions.get("custody_disclosure") === CURRENT_CUSTODY_VERSION
  );
}

/**
 * Require current legal acceptance before financial actions (Req 34.1, 34.5).
 * Throws ForbiddenError if acceptance is missing or outdated.
 */
export async function requireLegalAcceptance(userId: string): Promise<void> {
  const accepted = await hasCurrentLegalAcceptance(userId);
  if (!accepted) {
    throw new ForbiddenError(
      "You must accept the current Terms of Service and Custody Disclosure before performing this action (Req 34.1).",
      { requiresAcceptance: true, termsVersion: CURRENT_TERMS_VERSION },
    );
  }
}

/**
 * Record a user's legal acceptance (Req 34.1).
 */
export async function recordLegalAcceptance(params: {
  userId: string;
  documentType: "terms" | "custody_disclosure";
  version: string;
  ipAddress?: string;
}): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from("legal_acceptances").upsert(
    {
      user_id: params.userId,
      document_type: params.documentType,
      version: params.version,
      accepted_at: new Date().toISOString(),
      ip_address: params.ipAddress ?? null,
    },
    { onConflict: "user_id,document_type" },
  );

  // Also update the users table for quick lookup
  if (params.documentType === "terms") {
    await supabase
      .from("users")
      .update({
        terms_accepted_version: params.version,
        terms_accepted_at: new Date().toISOString(),
      })
      .eq("id", params.userId);
  }
}

/**
 * Check if mainnet operations are enabled (Req 34.3).
 */
export function isMainnetEnabled(): boolean {
  return process.env.STELLAR_MAINNET_ENABLED === "true";
}

/**
 * Gate mainnet operations (Req 34.3).
 */
export function requireMainnetEnabled(): void {
  if (!isMainnetEnabled()) {
    throw new ForbiddenError(
      "Mainnet financial operations are not enabled in this environment (Req 34.3).",
    );
  }
}

/**
 * Check KYC requirements (Req 34.4). In testnet, no KYC required.
 */
export async function checkKycRequirement(
  userId: string,
  networkMode: "testnet" | "mainnet",
): Promise<{ required: boolean; verified: boolean }> {
  if (networkMode === "testnet") {
    return { required: false, verified: true };
  }

  // For mainnet, check if identity verification threshold is met
  const threshold = Number(process.env.KYC_THRESHOLD_XLM ?? "10000");
  // TODO: Implement actual KYC provider integration
  return { required: true, verified: false };
}
