/**
 * Disbursement signing tests (Task 0.2 verification, Task 5.1).
 *
 * Core assertions:
 * 1. decryptSecret is called with the stored encrypted key (signing path exists)
 * 2. When KMS fails, submitSignedTx is NEVER called (fail-safe guard)
 * 3. Empty winner list returns immediately without touching KMS
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DisbursementService } from "../disbursement.service";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import * as kms from "@/lib/services/kms";
import * as notification from "@/lib/services/notification";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/stellar/client");
vi.mock("@/lib/services/kms");
vi.mock("@/lib/events/publisher", () => ({
  publishDomainEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/services/notification");
vi.mock("@/lib/repositories/escrow.repository", () => ({
  EscrowRepository: { disbursePrizes: vi.fn().mockResolvedValue(undefined) },
}));

const ESCROW_DATA = {
  id: "escrow-1",
  event_id: "event-1",
  stellar_public_key: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
  encrypted_secret_key: "aes:iv:tag:cipher",
};

const mockStellar = {
  getNetworkMode: vi.fn().mockReturnValue("testnet"),
  getBalance: vi.fn().mockResolvedValue("1000"),
  buildPaymentBatch: vi.fn().mockResolvedValue("FAKE_XDR"),
  submitSignedTx: vi.fn().mockResolvedValue({ hash: "hash123", successful: true }),
};

/** Fully-chained mock: every builder method returns `this` except terminal resolutions. */
function makeFullChain(finalValue: unknown) {
  const chain: Record<string, unknown> = {};
  const self = vi.fn(() => chain);
  chain.select = self;
  chain.eq = self;
  chain.in = self;
  chain.update = self;
  chain.single = vi.fn().mockResolvedValue(finalValue);
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  // Make awaitable (Supabase builder pattern)
  const resolved = Promise.resolve(finalValue);
  chain.then = resolved.then.bind(resolved);
  chain.catch = resolved.catch.bind(resolved);
  return chain as any;
}

/** Winners chain: .select().eq(event).eq(status) must resolve via awaiting the chain */
function makeWinnersChain(data: unknown[]) {
  const resolved = Promise.resolve({ data, error: null });
  const chain: Record<string, unknown> = {};
  const self = vi.fn(() => chain);
  chain.select = self;
  chain.eq = self;
  chain.update = vi.fn().mockReturnThis();
  chain.single = vi.fn().mockResolvedValue({ data: null });
  chain.then = resolved.then.bind(resolved);
  chain.catch = resolved.catch.bind(resolved);
  return chain as any;
}

beforeEach(() => {
  // resetAllMocks clears call history but keeps mock implementations from vi.mock factories
  vi.resetAllMocks();
  vi.mocked(getStellarClient).mockReturnValue(mockStellar as any);
  // Ensure notification mock always resolves (reset wipes return values)
  vi.mocked(notification.createNotification).mockResolvedValue("" as any);
  // Restore stellar mock return values after reset
  mockStellar.getNetworkMode.mockReturnValue("testnet");
  mockStellar.getBalance.mockResolvedValue("1000");
  mockStellar.buildPaymentBatch.mockResolvedValue("FAKE_XDR");
  mockStellar.submitSignedTx.mockResolvedValue({ hash: "hash123", successful: true });
});

describe("DisbursementService — KMS signing gate (Task 0.2)", () => {
  it("aborts and does NOT call submitSignedTx when KMS decryption fails", async () => {
    const walletsData = [
      {
        user_id: "u1",
        public_key: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
        verification_status: "Verified",
      },
    ];

    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: true }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "escrow_accounts") return makeFullChain({ data: ESCROW_DATA });
        if (table === "winners") {
          return makeWinnersChain([
            { id: "w1", recipient_id: "u1", prize_amount: "100", disbursement_status: "pending" },
          ]);
        }
        if (table === "wallets") {
          // .select().in().eq() chain
          return makeFullChain({ data: walletsData });
        }
        return makeFullChain({ data: { organizer_id: "org-1" } });
      }),
    } as any);

    vi.mocked(kms.decryptSecret).mockRejectedValue(new Error("KMS unavailable"));

    await expect(DisbursementService.executeDisbursement("event-1", "actor-1")).rejects.toThrow(
      "KMS decryption failed",
    );

    // The critical invariant: no transaction ever submitted when KMS fails
    expect(mockStellar.submitSignedTx).not.toHaveBeenCalled();
  });

  it("calls decryptSecret with the stored encrypted_secret_key", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: true }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "escrow_accounts") return makeFullChain({ data: ESCROW_DATA });
        if (table === "winners") {
          return makeWinnersChain([
            { id: "w1", recipient_id: "u1", prize_amount: "100", disbursement_status: "pending" },
          ]);
        }
        if (table === "wallets") {
          // No verified wallets — all winners held, but KMS still called
          return makeFullChain({ data: [] });
        }
        return makeFullChain({ data: { organizer_id: "org-1" } });
      }),
    } as any);

    vi.mocked(kms.decryptSecret).mockResolvedValue(
      "SCZANGBA5YHTNYVVV3C7CAZMCLFJLQCFKV3L6GBO7KN2VB5CYC3ZA6V",
    );

    await DisbursementService.executeDisbursement("event-1", "actor-1");

    // KMS called with exactly the key stored on the escrow row
    expect(kms.decryptSecret).toHaveBeenCalledWith("aes:iv:tag:cipher");
  });

  it("returns empty result immediately when no pending winners — KMS not called", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: true }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "escrow_accounts") return makeFullChain({ data: ESCROW_DATA });
        if (table === "winners") return makeWinnersChain([]); // empty
        return makeFullChain({ data: null });
      }),
    } as any);

    const result = await DisbursementService.executeDisbursement("ev1", "actor");

    expect(result.paid).toHaveLength(0);
    expect(result.held).toHaveLength(0);
    // KMS must NOT be called when there are no winners
    expect(kms.decryptSecret).not.toHaveBeenCalled();
  });
});
