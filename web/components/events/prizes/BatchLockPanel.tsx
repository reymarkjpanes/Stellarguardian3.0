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
  categories: PrizeCategory[];
  allocations: PrizeAllocation[];
  eventId: string;
  setStatus?: (status: string) => void;
}

export function BatchLockPanel({
  batchId,
  status,
  setStatus,
  categories,
  allocations,
  eventId,
}: BatchLockPanelProps) {
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    setBatchError(null);
    setBatchMessage(null);
    try {
      const res = await validateBatchAction(batchId);
      if (res.valid) {
        setStatus?.("Validated");
        setValidationErrors([]);
        setBatchMessage("Validation successful! Batch is now ready to lock.");
      } else {
        setValidationErrors(res.errors ?? []);
      }
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    if (status !== "Validated") {
      setBatchError("You must validate the batch first.");
      return;
    }
    setConfirmLock(false);
    setLoading(true);
    setBatchError(null);
    setBatchMessage(null);
    try {
      await lockBatchAction(batchId);
      setStatus?.("Locked");
      setBatchMessage("Batch Locked successfully! Ready for Escrow.");
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : String(err));
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

        {batchMessage && (
          <div
            role="status"
            className="p-3 rounded-md bg-green-500/10 border border-green-500/30 text-sm text-green-700 dark:text-green-300 flex justify-between"
          >
            <span>{batchMessage}</span>
            <button onClick={() => setBatchMessage(null)} className="text-xs hover:underline ml-3">
              ✕
            </button>
          </div>
        )}
        {batchError && (
          <div
            role="alert"
            className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive flex justify-between"
          >
            <span>{batchError}</span>
            <button onClick={() => setBatchError(null)} className="text-xs hover:underline ml-3">
              ✕
            </button>
          </div>
        )}

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
          {status === "Validated" && !confirmLock && (
            <Button
              onClick={() => setConfirmLock(true)}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              Lock &amp; Send to Escrow
            </Button>
          )}
          {status === "Validated" && confirmLock && (
            <div
              role="alertdialog"
              aria-label="Confirm lock batch"
              className="w-full rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2"
            >
              <p className="text-sm text-destructive font-medium">
                Lock allocations? This permanently freezes them and hands them to Escrow.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleLock} disabled={loading} variant="destructive" size="sm">
                  {loading ? "Locking…" : "Confirm Lock"}
                </Button>
                <Button onClick={() => setConfirmLock(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {(status === "Locked" || status === "Escrowed") && (
            <div className="flex flex-col items-center gap-4 p-4 w-full text-center bg-muted text-muted-foreground rounded-md">
              <p>Batch is Locked and handed over to Escrow. No further edits allowed.</p>
              <Button
                onClick={() => (window.location.href = `/events/${eventId}/escrow`)}
                variant="outline"
              >
                Proceed to Escrow
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
