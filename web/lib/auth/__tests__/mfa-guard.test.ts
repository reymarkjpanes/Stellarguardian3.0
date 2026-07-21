/**
 * Tests for mfa-guard.ts — MFA enforcement logic.
 *
 * Verifies:
 * 1. Testnet operations pass without MFA
 * 2. Mainnet operations require AAL2
 * 3. Mainnet operations throw if AAL1 only
 * 4. Errors in MFA check are handled gracefully
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireMfaForMainnet } from "../mfa-guard";

describe("requireMfaForMainnet", () => {
  const originalNetworkMode = process.env.STELLAR_NETWORK_MODE;
  const originalMainnetEnabled = process.env.STELLAR_MAINNET_ENABLED;

  afterEach(() => {
    if (originalNetworkMode !== undefined) {
      process.env.STELLAR_NETWORK_MODE = originalNetworkMode;
    } else {
      delete process.env.STELLAR_NETWORK_MODE;
    }
    if (originalMainnetEnabled !== undefined) {
      process.env.STELLAR_MAINNET_ENABLED = originalMainnetEnabled;
    } else {
      delete process.env.STELLAR_MAINNET_ENABLED;
    }
  });

  function mockSupabase(currentLevel: string, error?: any) {
    return {
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: error ? null : { currentLevel },
            error: error ?? null,
          }),
        },
      },
    } as any;
  }

  it("passes without MFA on testnet (default)", async () => {
    process.env.STELLAR_NETWORK_MODE = "testnet";
    const supabase = mockSupabase("aal1");
    await expect(requireMfaForMainnet(supabase)).resolves.toBeUndefined();
    // Should not even call MFA check
    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("passes without MFA when STELLAR_NETWORK_MODE is undefined (defaults to testnet)", async () => {
    delete process.env.STELLAR_NETWORK_MODE;
    const supabase = mockSupabase("aal1");
    await expect(requireMfaForMainnet(supabase)).resolves.toBeUndefined();
  });

  it("passes on mainnet with AAL2", async () => {
    process.env.STELLAR_NETWORK_MODE = "mainnet";
    process.env.STELLAR_MAINNET_ENABLED = "true";
    const supabase = mockSupabase("aal2");
    await expect(requireMfaForMainnet(supabase)).resolves.toBeUndefined();
  });

  it("throws ForbiddenError on mainnet with AAL1", async () => {
    process.env.STELLAR_NETWORK_MODE = "mainnet";
    process.env.STELLAR_MAINNET_ENABLED = "true";
    const supabase = mockSupabase("aal1");
    await expect(requireMfaForMainnet(supabase)).rejects.toThrow(
      "Multi-factor authentication",
    );
  });

  it("throws ForbiddenError when MFA check errors", async () => {
    process.env.STELLAR_NETWORK_MODE = "mainnet";
    process.env.STELLAR_MAINNET_ENABLED = "true";
    const supabase = mockSupabase("", { message: "Session expired" });
    await expect(requireMfaForMainnet(supabase)).rejects.toThrow(
      "Unable to verify MFA status",
    );
  });

  it("passes on mainnet when STELLAR_MAINNET_ENABLED is not true", async () => {
    process.env.STELLAR_NETWORK_MODE = "mainnet";
    process.env.STELLAR_MAINNET_ENABLED = "false";
    const supabase = mockSupabase("aal1");
    await expect(requireMfaForMainnet(supabase)).resolves.toBeUndefined();
  });
});
