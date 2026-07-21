/**
 * RefundService tests (Task 5.1).
 * Verifies: KMS decryption, abort on KMS failure, zero-balance fast path, missing wallet guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefundService } from "../refund.service";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import * as kms from "@/lib/services/kms";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/stellar/client");
vi.mock("@/lib/services/kms");
vi.mock("@/lib/services/audit");
vi.mock("@/lib/services/notification", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// Mock the Stellar SDK so TransactionBuilder.fromXDR doesn't throw on fake XDR
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  const mockTx = {
    sign: vi.fn(),
    toXDR: vi.fn().mockReturnValue("SIGNED_XDR_MOCK"),
  };
  return {
    ...actual,
    Networks: {
      TESTNET: "Test SDF Network ; September 2015",
      PUBLIC: "Public Global Stellar Network ; September 2015",
    },
    Keypair: {
      fromSecret: vi
        .fn()
        .mockReturnValue({ sign: vi.fn(), publicKey: vi.fn().mockReturnValue("GPUB") }),
    },
    TransactionBuilder: {
      fromXDR: vi.fn().mockReturnValue(mockTx),
    },
  };
});

const ESCROW_ROW = {
  id: "escrow-1",
  event_id: "event-1",
  stellar_public_key: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
  encrypted_secret_key: "aes:fake:key:value",
  funding_wallet: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZGA3DOQKX5RL73X92FAA",
  version: 0,
};

function makeChain(resolved: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue(resolved),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  return chain;
}

function buildSupabase(escrowOverrides: Partial<typeof ESCROW_ROW> = {}) {
  const row = { ...ESCROW_ROW, ...escrowOverrides };
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "escrow_accounts") return makeChain({ data: row });
      if (table === "transactions") return makeChain({ error: null });
      return makeChain({ data: { organizer_id: "org-1" } });
    }),
  };
}

const mockStellar = {
  getNetworkMode: vi.fn().mockReturnValue("testnet"),
  getBalance: vi.fn(),
  buildPaymentBatch: vi.fn().mockResolvedValue("UNSIGNED_XDR"),
  submitSignedTx: vi.fn().mockResolvedValue({ hash: "refund-tx-hash", successful: true }),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getStellarClient).mockReturnValue(mockStellar as any);
  // Restore stellar mock implementations after reset
  mockStellar.getNetworkMode.mockReturnValue("testnet");
  mockStellar.getBalance.mockResolvedValue("0"); // safe default: zero balance
  mockStellar.buildPaymentBatch.mockResolvedValue("UNSIGNED_XDR");
  mockStellar.submitSignedTx.mockResolvedValue({ hash: "refund-tx-hash", successful: true });
});

describe("RefundService.executeRefund", () => {
  it("returns success immediately when balance is zero (no KMS needed)", async () => {
    vi.mocked(createServiceClient).mockReturnValue(buildSupabase() as any);
    vi.mocked(kms.decryptSecret).mockResolvedValue("STEST");
    mockStellar.getBalance.mockResolvedValue("0");

    const result = await RefundService.executeRefund("event-1", "actor-1");

    expect(result.success).toBe(true);
    expect(result.attemptsUsed).toBe(0);
    expect(mockStellar.buildPaymentBatch).not.toHaveBeenCalled();
  });

  it("aborts with error when KMS decryption fails", async () => {
    vi.mocked(createServiceClient).mockReturnValue(buildSupabase() as any);
    vi.mocked(kms.decryptSecret).mockRejectedValue(new Error("KMS error"));
    mockStellar.getBalance.mockResolvedValue("100");

    await expect(RefundService.executeRefund("event-1", "actor-1")).rejects.toThrow(
      "KMS decryption failed",
    );
    expect(mockStellar.buildPaymentBatch).not.toHaveBeenCalled();
  });

  it("returns success with txHash on first successful attempt", async () => {
    vi.mocked(createServiceClient).mockReturnValue(buildSupabase() as any);
    vi.mocked(kms.decryptSecret).mockResolvedValue(
      "SCZANGBA5YHTNYVVV3C7CAZMCLFJLQCFKV3L6GBO7KN2VB5CYC3ZA6V",
    );
    mockStellar.getBalance.mockResolvedValue("500");
    // The service dynamically imports @stellar/stellar-sdk and calls TransactionBuilder.fromXDR.
    // With fake XDR it would throw and retry. Short-circuit by making submitSignedTx succeed
    // immediately when called with any argument (it receives the signed XDR from the tx mock).
    // We intercept at the client level: buildPaymentBatch returns a real-ish XDR string and
    // submitSignedTx is called directly.
    // The easiest isolation: make the Stellar client submit directly without signing by
    // making the service's internal `TransactionBuilder.fromXDR` return a mock transaction.
    const stellarSdk = await import("@stellar/stellar-sdk");
    const mockTx = { sign: vi.fn(), toXDR: vi.fn().mockReturnValue("SIGNED_XDR") };
    const fromXdrSpy = vi
      .spyOn(stellarSdk.TransactionBuilder, "fromXDR")
      .mockReturnValue(mockTx as any);

    mockStellar.submitSignedTx.mockResolvedValue({ hash: "refund-hash-abc", successful: true });

    const result = await RefundService.executeRefund("event-1", "actor-1");

    fromXdrSpy.mockRestore();

    expect(result.success).toBe(true);
    expect(result.txHash).toBe("refund-hash-abc");
    expect(result.attemptsUsed).toBe(1);
    expect(kms.decryptSecret).toHaveBeenCalledWith("aes:fake:key:value");
  });

  it("throws if no funding_wallet configured", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildSupabase({ funding_wallet: null as any }) as any,
    );
    vi.mocked(kms.decryptSecret).mockResolvedValue("STEST");
    mockStellar.getBalance.mockResolvedValue("100");

    await expect(RefundService.executeRefund("event-1", "actor-1")).rejects.toThrow(
      "No funding wallet",
    );
  });

  it("throws if escrow not found", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(makeChain({ data: null })),
    } as any);

    await expect(RefundService.executeRefund("event-1", "actor-1")).rejects.toThrow(
      "Escrow account not found",
    );
  });
});
