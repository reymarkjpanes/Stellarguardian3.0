import { describe, it, expect, vi, beforeEach } from "vitest";
import { AllocationService } from "./AllocationService";

// vi.hoisted() runs before vi.mock() hoisting, making refs available in factory
const { rpcMock, authGetUserMock, supabaseInstance } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const authGetUserMock = vi.fn().mockResolvedValue({
    data: { user: { id: "test-user-id" } },
  });
  const supabaseInstance = {
    rpc: rpcMock,
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }),
    auth: { getUser: authGetUserMock },
  };
  return { rpcMock, authGetUserMock, supabaseInstance };
});

// Service imports `createServerClient as createClient`
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue(supabaseInstance),
  createClient: vi.fn().mockResolvedValue(supabaseInstance),
}));

describe("AllocationService", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    authGetUserMock.mockResolvedValue({ data: { user: { id: "test-user-id" } } });
  });

  describe("allocatePrize", () => {
    it("returns domain event on success", async () => {
      rpcMock.mockResolvedValueOnce({ data: "new-allocation-id", error: null });

      const result = await AllocationService.allocatePrize(
        "batch-123",
        "cat-456",
        "sub-789",
        1000,
        "Great UI",
        "snap-000",
      );

      expect(rpcMock).toHaveBeenCalledWith("allocate_prize", {
        p_batch_id: "batch-123",
        p_category_id: "cat-456",
        p_submission_id: "sub-789",
        p_amount: 1000,
        p_reason: "Great UI",
        p_ranking_snapshot_id: "snap-000",
        p_user_id: "test-user-id",
      });

      expect(result.allocationId).toBe("new-allocation-id");
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("PrizeAllocated");
    });

    it("throws error if rpc fails (e.g. budget exceeded)", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Allocation exceeds category budget." },
      });

      await expect(
        AllocationService.allocatePrize(
          "batch-123",
          "cat-456",
          "sub-789",
          99999,
          "Reason",
          "snap-000",
        ),
      ).rejects.toThrow("Failed to allocate prize: Allocation exceeds category budget.");
    });
  });

  describe("lockBatch", () => {
    it("returns lock event on success", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      const events = await AllocationService.lockBatch("batch-123");

      expect(rpcMock).toHaveBeenCalledWith("lock_prize_allocations", {
        p_batch_id: "batch-123",
        p_user_id: "test-user-id",
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("PrizeAllocationLocked");
      expect((events[0] as any).lockedBy).toBe("test-user-id");
    });
  });
});
