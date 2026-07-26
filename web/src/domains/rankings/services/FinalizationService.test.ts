import { describe, it, expect, vi } from "vitest";
import { FinalizationService } from "./FinalizationService";

// vi.hoisted() runs before any module-level code, so EVAL_DATA must live inside it
const { mockRpc, mockSupabase } = vi.hoisted(() => {
  const EVAL_DATA = [
    {
      id: "eval-1",
      submission_id: "sub-1",
      judge_id: "judge-1",
      status: "Submitted",
      scores: { criteria: [{ score: 10, weight: 1, maxScore: 10 }] },
      conflict_of_interest: false,
      total_score: 10,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "eval-2",
      submission_id: "sub-2",
      judge_id: "judge-1",
      status: "Submitted",
      scores: { criteria: [{ score: 15, weight: 1, maxScore: 20 }] },
      conflict_of_interest: false,
      total_score: 15,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockRpc = vi.fn();
  const mockEq2 = vi.fn().mockResolvedValue({ data: EVAL_DATA, error: null });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
  const mockSupabase = {
    from: vi.fn().mockReturnValue({ select: mockSelect }),
    rpc: mockRpc,
  };
  return { mockRpc, mockSupabase };
});

// Service uses `createServerClient as createClient`
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue(mockSupabase),
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

describe("FinalizationService", () => {
  it("should calculate rankings and invoke finalization RPC", async () => {
    mockRpc.mockResolvedValue({ error: null });

    const rankings = await FinalizationService.finalizeEvent("event-1", 5);

    expect(rankings).toHaveLength(2);
    // sub-2 score=15 > sub-1 score=10 → sub-2 is rank 1
    expect(rankings[0]!.submissionId).toBe("sub-2");
    expect(rankings[0]!.ranking).toBe(1);
    expect(rankings[1]!.submissionId).toBe("sub-1");
    expect(rankings[1]!.ranking).toBe(2);

    expect(mockRpc).toHaveBeenCalledWith("finalize_event_judging", {
      p_event_id: "event-1",
      p_expected_version: 5,
      p_rankings_json: rankings,
    });
  });

  it("should rollback/throw if RPC returns an error (e.g. version mismatch)", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "Concurrency conflict: event version mismatch" },
    });

    await expect(FinalizationService.finalizeEvent("event-1", 4)).rejects.toThrow(
      "Finalization transaction failed: Concurrency conflict: event version mismatch",
    );
  });
});
