/**
 * SettlementService tests (Task 5.1, Task 3.2).
 *
 * The Supabase query builder is thenable — `await builder.select().eq()...`
 * resolves to `{ data, error }`. We implement the chain as a thenable object
 * where `then()` is attached to the final result so `await chain` resolves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettlementService } from "../settlement.service";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/services/audit");

/** Create a thenable chain that resolves to `resolved` when awaited. */
function thenableChain(resolved: unknown) {
  let resolver: ((v: unknown) => void) | null = null;
  const p = new Promise((resolve) => {
    resolver = resolve;
  });
  resolver!(resolved);

  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.single = vi.fn().mockResolvedValue(resolved);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  // Make the chain awaitable — Supabase builder resolves when awaited
  chain.then = (onfulfilled: (v: unknown) => unknown) => p.then(onfulfilled);
  chain.catch = (onrejected: (v: unknown) => unknown) => p.catch(onrejected);
  chain.finally = (onfinally: () => void) => p.finally(onfinally);
  return chain as any;
}

/**
 * Settlement service calls `supabase.from("transactions")` twice:
 *  - .select().eq(id).eq(type="fund").eq(status)    → fund transactions
 *  - .select().eq(id).eq(type="disbursement").eq(status) → disburse transactions
 *
 * We distinguish by tracking `from` call index.
 */
function buildSupabase({
  escrow = { id: "e1", event_id: "ev1", state: "Released", expected_balance: "500" },
  fundTxAmounts = [300, 200],
  disburseTxAmounts = [450],
  batchId = "batch-1",
  settlementId = "s1",
} = {}) {
  let txCallIdx = 0;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "escrow_accounts") {
        return thenableChain({ data: escrow, error: null });
      }

      if (table === "transactions") {
        const idx = txCallIdx++;
        const amounts = idx === 0 ? fundTxAmounts : disburseTxAmounts;
        const data = amounts.map((a) => ({ amount: String(a) }));
        return thenableChain({ data, error: null });
      }

      if (table === "payout_batches") {
        return thenableChain({ data: { id: batchId } });
      }

      if (table === "settlements") {
        // insert().select().single() path
        const chain = thenableChain({
          data: { id: settlementId, settled_at: new Date().toISOString() },
          error: null,
        });
        chain.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: settlementId, settled_at: new Date().toISOString() },
              error: null,
            }),
          }),
        });
        return chain;
      }

      return thenableChain({ data: null, error: null });
    }),
  };
}

describe("SettlementService.recordSettlement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("computes totalFunded, totalDisbursed, and discrepancy correctly", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildSupabase({ fundTxAmounts: [300, 200], disburseTxAmounts: [450] }) as any,
    );

    const result = await SettlementService.recordSettlement("e1", "actor-1");

    expect(result.totalFunded).toBe(500);
    expect(result.totalDisbursed).toBe(450);
    expect(result.discrepancy).toBe(50);
    expect(result.escrowId).toBe("e1");
    expect(result.payoutBatchId).toBe("batch-1");
  });

  it("handles zero discrepancy (perfect settlement)", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildSupabase({ fundTxAmounts: [500], disburseTxAmounts: [500] }) as any,
    );

    const result = await SettlementService.recordSettlement("e1", "actor-1");
    expect(result.discrepancy).toBe(0);
    expect(result.totalFunded).toBe(500);
    expect(result.totalDisbursed).toBe(500);
  });

  it("handles empty transaction history (all zeros)", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildSupabase({ fundTxAmounts: [], disburseTxAmounts: [] }) as any,
    );

    const result = await SettlementService.recordSettlement("e1", "actor-1");
    expect(result.totalFunded).toBe(0);
    expect(result.totalDisbursed).toBe(0);
    expect(result.discrepancy).toBe(0);
  });

  it("throws if escrow not found", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(thenableChain({ data: null, error: { message: "not found" } })),
    } as any);

    await expect(SettlementService.recordSettlement("missing", "actor")).rejects.toThrow(
      "Escrow not found",
    );
  });
});
