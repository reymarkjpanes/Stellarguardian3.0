import { describe, expect, it, vi, beforeEach } from "vitest";
import { DisbursementService } from "../disbursement.service";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { ValidationError } from "@/lib/errors";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/stellar/client", () => ({
  getStellarClient: vi.fn(),
}));

describe("DisbursementService.validatePrizeAllocation", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  const mockStellar = {
    getBalance: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);
    vi.mocked(getStellarClient).mockReturnValue(mockStellar as any);
  });

  it("throws Error if escrow account not found", async () => {
    mockSupabase.single.mockResolvedValue({ data: null });

    await expect(
      DisbursementService.validatePrizeAllocation("event-1", [{ recipientId: "u1", amount: "100" }])
    ).rejects.toThrow("Escrow account not found.");
  });

  it("throws ValidationError if allocation exceeds on-chain balance", async () => {
    mockSupabase.single.mockResolvedValue({ data: { stellar_public_key: "G123" } });
    mockStellar.getBalance.mockResolvedValue("150.00");

    await expect(
      DisbursementService.validatePrizeAllocation("event-1", [
        { recipientId: "u1", amount: "100" },
        { recipientId: "u2", amount: "60" },
      ])
    ).rejects.toThrow(ValidationError);
  });

  it("passes if allocation is within on-chain balance", async () => {
    mockSupabase.single.mockResolvedValue({ data: { stellar_public_key: "G123" } });
    mockStellar.getBalance.mockResolvedValue("200.00");

    await expect(
      DisbursementService.validatePrizeAllocation("event-1", [
        { recipientId: "u1", amount: "100" },
        { recipientId: "u2", amount: "60" },
      ])
    ).resolves.toBeUndefined();
  });
});
