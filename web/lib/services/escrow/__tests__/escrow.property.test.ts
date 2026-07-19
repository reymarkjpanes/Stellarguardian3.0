import { describe, expect, it, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { DisbursementService } from "../disbursement.service";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/stellar/client", () => ({
  getStellarClient: vi.fn(),
}));

describe("Property tests: Escrow Financial Logic", () => {
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

  it("validatePrizeAllocation correctly identifies when total exceeds on-chain balance", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 100000000 }), // onChainBalance
        fc.array(fc.nat({ max: 10000000 })), // allocations
        async (balance, allocs) => {
          mockSupabase.single.mockResolvedValue({ data: { stellar_public_key: "G123" } });
          mockStellar.getBalance.mockResolvedValue(String(balance));

          const totalAllocated = allocs.reduce((sum, a) => sum + a, 0);
          const allocations = allocs.map((a, i) => ({ recipientId: `u${i}`, amount: String(a) }));

          if (totalAllocated > balance) {
            await expect(
              DisbursementService.validatePrizeAllocation("event-1", allocations)
            ).rejects.toThrow();
          } else {
            await expect(
              DisbursementService.validatePrizeAllocation("event-1", allocations)
            ).resolves.toBeUndefined();
          }
        }
      ),
      fcConfig
    );
  });
});
