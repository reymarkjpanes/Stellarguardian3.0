import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { allocatePrizeAction, removeAllocationAction } from '@/app/actions/prize-allocation.actions';

export function PrizeAllocationBoard({ batchId, categories, snapshots, allocations, setAllocations, isLocked }: any) {
  const [loading, setLoading] = useState(false);

  const handleAllocate = async (snapshot: any, category: any) => {
    if (isLocked) return;
    setLoading(true);
    try {
      const res = await allocatePrizeAction(
        batchId,
        category.id,
        snapshot.submission_id,
        category.total_amount, // simplistically assigning max to 1 for now
        `Assigned to Rank #${snapshot.ranking}`,
        snapshot.id
      );
      // Optimistically add to list (we would ideally refresh or return the whole object from RPC)
      setAllocations([...allocations, {
        id: res.allocationId,
        batch_id: batchId,
        category_id: category.id,
        submission_id: snapshot.submission_id,
        amount: category.total_amount,
        allocation_status: 'Draft',
        prize_categories: category
      }]);
    } catch (err: any) {
      alert(`Allocation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (allocationId: string) => {
    if (isLocked) return;
    setLoading(true);
    try {
      await removeAllocationAction(allocationId);
      setAllocations(allocations.filter((a: any) => a.id !== allocationId));
    } catch (err: any) {
      alert(`Remove failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Rankings */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Finalized Rankings</h3>
          <div className="space-y-2">
            {snapshots.map((s: any) => (
              <div key={s.id} className="card p-3 flex justify-between items-center bg-background">
                <div>
                  <span className="font-bold mr-2 text-primary">#{s.ranking}</span>
                  <span className="font-medium">{s.submissions.title}</span>
                </div>
                <div className="flex gap-2">
                  {categories.map((c: any) => {
                    const existingAlloc = allocations.find((a: any) => a.submission_id === s.submission_id && a.category_id === c.id);
                    if (existingAlloc) {
                      return (
                        <Button key={c.id} variant="default" size="sm" onClick={() => handleRemove(existingAlloc.id)} disabled={loading || isLocked}>
                          {c.name} ✓
                        </Button>
                      );
                    }
                    return (
                      <Button key={c.id} variant="outline" size="sm" onClick={() => handleAllocate(s, c)} disabled={loading || isLocked}>
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
          {categories.map((c: any) => {
            const catAllocs = allocations.filter((a: any) => a.category_id === c.id);
            const totalAllocated = catAllocs.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
            return (
              <div key={c.id} className="card p-4 bg-background">
                <div className="flex justify-between font-semibold">
                  <span>{c.name}</span>
                  <span>{totalAllocated} / {c.total_amount}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {catAllocs.map((a: any) => {
                    const snap = snapshots.find((s: any) => s.submission_id === a.submission_id);
                    return (
                      <div key={a.id} className="text-sm flex justify-between text-muted-foreground">
                        <span>Rank #{snap?.ranking} ({snap?.submissions.title})</span>
                        <span>{a.amount}</span>
                      </div>
                    );
                  })}
                  {catAllocs.length === 0 && <span className="text-sm text-muted-foreground">No allocations yet.</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
