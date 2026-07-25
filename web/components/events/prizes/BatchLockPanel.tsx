import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { validateBatchAction, lockBatchAction } from "@/app/actions/prize-allocation.actions";

export interface PrizeCategory {
  id: string;
  name: string;
  prize_type: string;
  total_amount: number | string;
  max_winners: number;
  currency?: string;
}

export interface PrizeAllocation {
  id: string;
  batch_id: string;
  category_id: string;
  submission_id: string;
  amount: number | string;
  allocation_status: string;
  prize_categories?: PrizeCategory;
}

interface BatchLockPanelProps {
  batchId: string;
  status: string;
  setStatus: (status: string) => void;
  categories: PrizeCategory[];
  allocations: PrizeAllocation[];
}

export function BatchLockPanel({
  batchId,
  status,
  setStatus,
  categories,
  allocations,
}: BatchLockPanelProps) {
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleValidate = async () => {
    setLoading(true);
    try {
      const res = await validateBatchAction(batchId);
      if (res.valid) {
        setStatus("Validated");
        setValidationErrors([]);
        alert("Validation successful! Batch is now ready to lock.");
      } else {
        setValidationErrors(res.errors ?? []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Validation failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    if (status !== "Validated") {
      alert("You must validate the batch first.");
      return;
    }
    const confirmed = confirm(
      "Are you sure? Locking will permanently freeze these allocations and hand them over to Escrow.",
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await lockBatchAction(batchId);
      setStatus("Locked");
      alert("Batch Locked successfully! Ready for Escrow (Module 8).");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Lock failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const totalBudget = categories.reduce((s, c) => s + Number(c.total_amount), 0);
  const totalAllocated = allocations.reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card p-6 bg-background space-y-6">
        <div>
          <h3 className="font-semibold text-lg">Batch Summary</h3>
          <p className="text-sm text-muted-foreground">
            Review the overall totals before finalizing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-md">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-semibold text-lg">{status}</p>
          </div>
          <div className="p-4 border rounded-md">
            <p className="text-sm text-muted-foreground">Total Allocations</p>
            <p className="font-semibold text-lg">{allocations.length}</p>
          </div>
          <div className="p-4 border rounded-md">
            <p className="text-sm text-muted-foreground">Total Budget</p>
            <p className="font-semibold text-lg">{totalBudget}</p>
          </div>
          <div className="p-4 border rounded-md">
            <p className="text-sm text-muted-foreground">Allocated Amount</p>
            <p className="font-semibold text-lg">{totalAllocated}</p>
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive rounded-md space-y-2">
            <p className="font-bold">Validation Errors:</p>
            <ul className="list-disc pl-5 text-sm">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-4 pt-4 border-t">
          {status === "Draft" && (
            <Button onClick={handleValidate} disabled={loading} className="w-full">
              Run Validation Pass
            </Button>
          )}
          {status === "Validated" && (
            <Button
              onClick={handleLock}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              Lock &amp; Send to Escrow
            </Button>
          )}
          {(status === "Locked" || status === "Escrowed") && (
            <div className="flex flex-col items-center gap-4 p-4 w-full text-center bg-muted text-muted-foreground rounded-md">
              <p>Batch is Locked and handed over to Escrow. No further edits allowed.</p>
              <Button onClick={() => (window.location.href = "./escrow")} variant="outline">
                Proceed to Escrow
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
