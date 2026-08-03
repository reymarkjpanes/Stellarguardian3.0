import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  allocatePrizeAction,
  removeAllocationAction,
} from "@/app/actions/prize-allocation.actions";
import type { PrizeCategory, PrizeAllocation } from "./BatchLockPanel";
import type { RankingSnapshot } from "./OrganizerPrizeDashboardClient";

interface PrizeAllocationBoardProps {
  batchId: string;
  categories: PrizeCategory[];
  snapshots: RankingSnapshot[];
  allocations: PrizeAllocation[];
  setAllocations: (allocations: PrizeAllocation[]) => void;
  isLocked: boolean;
}

export function PrizeAllocationBoard({
  batchId,
  categories,
  snapshots,
  allocations,
  setAllocations,
  isLocked,
}: PrizeAllocationBoardProps) {
  const [loading, setLoading] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const handleAllocate = async (snapshot: RankingSnapshot, category: PrizeCategory) => {
    if (isLocked) return;
    setAllocationError(null);
    setLoading(true);
    try {
      const res = await allocatePrizeAction(
        batchId,
        category.id,
        snapshot.submission_id,
        Number(category.total_amount),
        `Assigned to Rank #${snapshot.ranking}`,
        snapshot.id,
      );
      setAllocations([
        ...allocations,
        {
          id: (res as { allocationId: string }).allocationId,
          batch_id: batchId,
          category_id: category.id,
          submission_id: snapshot.submission_id,
          amount: Number(category.total_amount),
          allocation_status: "Draft",
          prize_categories: category,
        },
      ]);
    } catch (err) {
      setAllocationError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (allocationId: string) => {
    if (isLocked) return;
    setAllocationError(null);
    setLoading(true);
    try {
      await removeAllocationAction(allocationId);
      setAllocations(allocations.filter((a) => a.id !== allocationId));
    } catch (err) {
      setAllocationError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {allocationError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 flex justify-between items-center text-sm text-destructive"
        >
          <span>{allocationError}</span>
          <button onClick={() => setAllocationError(null)} className="text-xs hover:underline ml-3">
            ✕
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Rankings */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Finalized Rankings</h3>
          <div className="space-y-2">
            {snapshots.map((s) => (
              <div key={s.id} className="card p-3 flex justify-between items-center bg-background">
                <div>
                  <span className="font-bold mr-2 text-primary">#{s.ranking}</span>
                  <span className="font-medium">{s.submissions.title}</span>
                </div>
                <div className="flex gap-2">
                  {categories.map((c) => {
                    const existingAlloc = allocations.find(
                      (a) => a.submission_id === s.submission_id && a.category_id === c.id,
                    );
                    if (existingAlloc) {
                      return (
                        <Button
                          key={c.id}
                          variant="default"
                          size="sm"
                          onClick={() => void handleRemove(existingAlloc.id)}
                          disabled={loading || isLocked}
                        >
                          {c.name} ✓
                        </Button>
                      );
                    }
                    return (
                      <Button
                        key={c.id}
                        variant="outline"
                        size="sm"
                        onClick={() => void handleAllocate(s, c)}
                        disabled={loading || isLocked}
                      >
                        + {c.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            {snapshots.length === 0 && <p className="text-muted-foreground">No rankings found.</p>}
          </div>
        </div>

        {/* Right: Allocation Summary */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Allocation Summary</h3>
          {categories.map((c) => {
            const catAllocs = allocations.filter((a) => a.category_id === c.id);
            const totalAllocated = catAllocs.reduce((sum, a) => sum + Number(a.amount), 0);
            return (
              <div key={c.id} className="card p-4 bg-background">
                <div className="flex justify-between font-semibold">
                  <span>{c.name}</span>
                  <span>
                    {totalAllocated} / {c.total_amount}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {catAllocs.map((a) => {
                    const snap = snapshots.find((s) => s.submission_id === a.submission_id);
                    return (
                      <div
                        key={a.id}
                        className="text-sm flex justify-between text-muted-foreground"
                      >
                        <span>
                          Rank #{snap?.ranking} ({snap?.submissions.title})
                        </span>
                        <span>{a.amount}</span>
                      </div>
                    );
                  })}
                  {catAllocs.length === 0 && (
                    <span className="text-sm text-muted-foreground">No allocations yet.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
