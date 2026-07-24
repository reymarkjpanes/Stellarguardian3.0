"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui/back-button";
import {
  createEscrowAction,
  verifyFundingAction,
  simulatePayoutBatchAction,
  generatePayoutBatchAction,
  releaseEscrowAction,
  reconcileSettlementAction,
  retryInstructionAction,
} from "@/app/actions/escrow.actions";

// ── Local types ──────────────────────────────────────────────────────────────

interface PrizeBatch {
  id: string;
  event_id: string;
  status: string;
  total_amount: number | null;
}

interface EscrowAccount {
  id: string;
  status: string;
  network: string;
  contract_address: string;
  expected_balance: string;
  prize_allocation_batch_id: string;
}

interface PayoutInstruction {
  id: string;
  destination_address: string;
  amount: string;
  status: string;
}

interface PayoutBatch {
  id: string;
  status: string;
  total_amount: string;
  payout_instructions: PayoutInstruction[];
}

interface Settlement {
  id: string;
  reconciled_amount: string;
  created_at: string;
}

interface SimulationResult {
  success: boolean;
  estimatedFee?: string;
  error?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EventEscrowPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);

  const [prizeBatch, setPrizeBatch] = useState<PrizeBatch | null>(null);
  const [escrow, setEscrow] = useState<EscrowAccount | null>(null);
  const [payoutBatch, setPayoutBatch] = useState<PayoutBatch | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  const [fundAmount, setFundAmount] = useState("");
  const [fundingStep, setFundingStep] = useState<
    "idle" | "connecting" | "signing" | "done" | "error"
  >("idle");
  const [fundingError, setFundingError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Real-time: pulse the live dot when a DB change arrives
  const [liveFlash, setLiveFlash] = useState(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: evt }, { data: pb }] = await Promise.all([
        supabase.from("events").select("id").eq("id", eventId).single(),
        supabase
          .from("prize_allocation_batches")
          .select("id, event_id, status, total_amount")
          .eq("event_id", eventId)
          .eq("status", "Locked")
          .maybeSingle(),
      ]);

      if (!evt) return;
      setPrizeBatch(pb as PrizeBatch | null);

      if (pb) {
        const { data: esc } = await supabase
          .from("escrow_accounts")
          .select(
            "id, status, network, contract_address, expected_balance, prize_allocation_batch_id",
          )
          .eq("prize_allocation_batch_id", pb.id)
          .maybeSingle();
        setEscrow(esc as EscrowAccount | null);

        if (esc) {
          const { data: pbatch } = await supabase
            .from("payout_batches")
            .select(
              "id, status, total_amount, payout_instructions(id, destination_address, amount, status)",
            )
            .eq("escrow_id", esc.id)
            .maybeSingle();
          setPayoutBatch(pbatch as PayoutBatch | null);

          if (pbatch) {
            const { data: setl } = await supabase
              .from("settlements")
              .select("id, reconciled_amount, created_at")
              .eq("payout_batch_id", pbatch.id)
              .maybeSingle();
            setSettlement(setl as Settlement | null);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Initial load — loadData is async; state updates happen after the await,
  // not synchronously within the effect body. Safe to suppress here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    const supabase = createBrowserClient();

    const onchange = () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
      setLiveFlash(true);
      liveTimer.current = setTimeout(() => setLiveFlash(false), 1500);
      void loadData();
    };

    const channel = supabase
      .channel(`escrow-realtime-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "escrow_accounts",
          filter: `event_id=eq.${eventId}`,
        },
        onchange,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "payout_batches" }, onchange)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payout_instructions" },
        onchange,
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "settlements" }, onchange)
      .subscribe();

    return () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [eventId, loadData]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleCreateEscrow() {
    if (!prizeBatch) return;
    setActionLoading("create");
    setActionError(null);
    try {
      const created = await createEscrowAction(
        eventId,
        prizeBatch.id,
        prizeBatch.total_amount ?? 0,
      );
      await generatePayoutBatchAction(created.escrowId, prizeBatch.id);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create escrow.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFundEscrow() {
    if (!escrow || !fundAmount) return;
    setFundingStep("connecting");
    setFundingError(null);

    try {
      const { getAvailableAdapters } = await import("@/lib/wallet/registry");
      const adapters = await getAvailableAdapters();
      if (adapters.length === 0)
        throw new Error("No wallet extension detected. Install Freighter or xBull.");

      const wallet = adapters[0]!;
      const { publicKey } = await wallet.connect();

      setFundingStep("signing");
      const { Horizon, TransactionBuilder, Operation, Asset, Networks } =
        await import("@stellar/stellar-sdk");
      const networkMode = escrow.network;
      const horizonUrl =
        networkMode === "public"
          ? "https://horizon.stellar.org"
          : "https://horizon-testnet.stellar.org";
      const networkPassphrase = networkMode === "public" ? Networks.PUBLIC : Networks.TESTNET;

      const server = new Horizon.Server(horizonUrl);
      const sourceAccount = await server.loadAccount(publicKey);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: escrow.contract_address,
            asset: Asset.native(),
            amount: fundAmount,
          }),
        )
        .setTimeout(180)
        .build();

      const signedXdr = await wallet.signTransaction(
        transaction.toXDR(),
        networkMode === "public" ? "mainnet" : "testnet",
      );

      const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
      const signedTx = TB.fromXDR(signedXdr, networkPassphrase);
      const submitResult = await server.submitTransaction(signedTx);
      if (!submitResult.successful) throw new Error("Transaction failed on Horizon.");

      setFundingStep("done");
      setFundAmount("");
      alert("Funding sent! Click 'Verify Funding' to confirm receipt on the backend.");
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : "Funding failed.");
      setFundingStep("error");
    }
  }

  async function handleVerifyFunding() {
    if (!escrow) return;
    setActionLoading("verify");
    setActionError(null);
    try {
      await verifyFundingAction(escrow.id);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSimulate() {
    if (!payoutBatch) return;
    setActionLoading("simulate");
    setActionError(null);
    try {
      const res = await simulatePayoutBatchAction(payoutBatch.id);
      setSimulationResult(res as SimulationResult);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease() {
    if (!payoutBatch) return;
    setActionLoading("release");
    setActionError(null);
    try {
      await releaseEscrowAction(payoutBatch.id);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Release failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSettle() {
    if (!payoutBatch) return;
    setActionLoading("settle");
    setActionError(null);
    try {
      await reconcileSettlementAction(payoutBatch.id);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Settlement failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetryInstruction(instructionId: string) {
    setActionLoading("retry");
    setActionError(null);
    try {
      await retryInstructionAction(instructionId);
      if (payoutBatch) await releaseEscrowAction(payoutBatch.id);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-sm text-[var(--text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        Loading escrow data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton href={`/events/${eventId}`} label="Back to Event" />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Escrow & Execution</h2>
        <span
          className={`inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-opacity ${liveFlash ? "opacity-100" : "opacity-50"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full bg-green-400 ${liveFlash ? "animate-ping" : ""}`}
          />
          Live
        </span>
      </div>

      {actionError && (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--error)_40%,transparent)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
          {actionError}
        </div>
      )}

      {/* Financial Workflow Timeline */}
      <div className="card p-6">
        <h3 className="font-medium mb-4">Financial Workflow Timeline</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge active={!!prizeBatch} label="1. Prize Batch Locked" />
          <Badge active={!!escrow} label="2. Escrow Created" />
          <Badge
            active={["Funded", "Verified", "Locked", "Releasing", "Completed"].includes(
              escrow?.status ?? "",
            )}
            label="3. Funding Verified"
          />
          <Badge
            active={[
              "Preparing",
              "Signing",
              "Broadcast",
              "Confirmed",
              "Partially Completed",
            ].includes(payoutBatch?.status ?? "")}
            label="4. Simulation Passed"
          />
          <Badge
            active={["Broadcast", "Confirmed", "Partially Completed"].includes(
              payoutBatch?.status ?? "",
            )}
            label="5. Payout Broadcast"
          />
          <Badge
            active={["Confirmed", "Partially Completed"].includes(payoutBatch?.status ?? "")}
            label="6. Confirmed"
          />
          <Badge active={!!settlement} label="7. Settlement Completed" />
        </div>
      </div>

      {!prizeBatch ? (
        <div className="card p-8 text-center text-[var(--text-muted)]">
          Prize Allocation Batch must be Locked before Escrow can be initialized.
        </div>
      ) : !escrow ? (
        <div className="card p-8 text-center space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Prize allocations are locked. Escrow is ready to be created.
          </p>
          <button
            onClick={handleCreateEscrow}
            disabled={!!actionLoading}
            className="btn-primary px-4 py-2 rounded-md disabled:opacity-50"
          >
            {actionLoading === "create" ? "Creating…" : "Create Escrow Account"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Escrow Details */}
          <div className="card p-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Escrow Status</p>
              <p className="font-medium">{escrow.status}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Network</p>
              <p className="font-medium capitalize">{escrow.network}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-[var(--text-muted)]">Escrow Address</p>
              <p className="font-mono text-xs break-all bg-[var(--bg-muted)] p-2 rounded mt-1">
                {escrow.contract_address}
              </p>
            </div>
          </div>

          {/* Funding Section */}
          {["Draft", "Funding", undefined].includes(escrow.status) && (
            <div className="card p-6 space-y-4">
              <h3 className="font-medium">Fund Escrow</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Target amount: <strong>{escrow.expected_balance} XLM</strong>
              </p>

              {fundingError && (
                <div className="rounded-md border border-[color-mix(in_srgb,var(--error)_40%,transparent)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error)]">
                  {fundingError}
                </div>
              )}

              <div className="flex gap-4 items-end border-b border-[var(--border)] pb-4">
                <div className="flex-1">
                  <label className="text-xs text-[var(--text-muted)]">Amount (XLM)</label>
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <button
                  onClick={handleFundEscrow}
                  disabled={fundingStep !== "idle"}
                  className="btn-secondary px-4 py-2 rounded-md text-sm disabled:opacity-50"
                >
                  {fundingStep === "connecting"
                    ? "Connecting…"
                    : fundingStep === "signing"
                      ? "Sign in wallet…"
                      : "Fund with Wallet"}
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleVerifyFunding}
                  disabled={!!actionLoading}
                  className="btn-primary px-4 py-2 rounded-md text-sm disabled:opacity-50"
                >
                  {actionLoading === "verify" ? "Verifying…" : "Verify Funding On-Chain"}
                </button>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Click after sending funds to confirm receipt on the backend.
                </p>
              </div>
            </div>
          )}

          {/* Payout Execution Section */}
          {["Funded", "Verified", "Locked", "Releasing", "Completed"].includes(escrow.status) &&
            payoutBatch &&
            !settlement && (
              <div className="card p-6 space-y-4">
                <h3 className="font-medium">Payout Execution</h3>

                <div className="grid grid-cols-2 gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Batch Status</p>
                    <p className="font-medium">{payoutBatch.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Total Payouts</p>
                    <p className="font-medium">{payoutBatch.total_amount} XLM</p>
                  </div>
                </div>

                {simulationResult && (
                  <div
                    className={`rounded-md p-4 text-sm space-y-1 ${simulationResult.success ? "bg-[var(--bg-muted)]" : "bg-[var(--error-bg)] text-[var(--error)]"}`}
                  >
                    <p>
                      <strong>Simulation:</strong>{" "}
                      {simulationResult.success ? "✓ Passed" : "✗ Failed"}
                    </p>
                    {simulationResult.estimatedFee && (
                      <p className="text-xs">Est. fee: {simulationResult.estimatedFee} XLM</p>
                    )}
                    {simulationResult.error && <p className="text-xs">{simulationResult.error}</p>}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  {["Pending", "Preparing"].includes(payoutBatch.status) && (
                    <button
                      onClick={handleSimulate}
                      disabled={!!actionLoading}
                      className="btn-secondary px-4 py-2 rounded-md text-sm disabled:opacity-50"
                    >
                      {actionLoading === "simulate" ? "Simulating…" : "Simulate Batch"}
                    </button>
                  )}

                  {["Preparing", "Signing"].includes(payoutBatch.status) &&
                    simulationResult?.success && (
                      <button
                        onClick={handleRelease}
                        disabled={!!actionLoading}
                        className="rounded-md bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === "release"
                          ? "Broadcasting…"
                          : "Release Escrow & Disburse"}
                      </button>
                    )}

                  {["Confirmed", "Partially Completed"].includes(payoutBatch.status) && (
                    <button
                      onClick={handleSettle}
                      disabled={!!actionLoading}
                      className="btn-primary px-4 py-2 rounded-md text-sm disabled:opacity-50"
                    >
                      {actionLoading === "settle" ? "Settling…" : "Create Settlement Record"}
                    </button>
                  )}
                </div>

                {/* Per-winner progress */}
                {["Broadcast", "Confirmed", "Partially Completed", "Failed"].includes(
                  payoutBatch.status,
                ) && (
                  <div className="mt-4 border border-[var(--border)] rounded-md overflow-hidden">
                    <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-muted)]">
                      <h4 className="text-xs font-medium text-[var(--text-muted)]">
                        Execution Progress
                      </h4>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {payoutBatch.payout_instructions.map((inst) => (
                        <div
                          key={inst.id}
                          className="flex items-center justify-between px-4 py-2 text-sm"
                        >
                          <span className="font-mono text-xs text-[var(--text-muted)]">
                            {inst.destination_address.slice(0, 8)}…
                            {inst.destination_address.slice(-4)}
                          </span>
                          <span className="text-xs">{inst.amount} XLM</span>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-medium ${
                                inst.status === "Confirmed"
                                  ? "text-green-500"
                                  : inst.status === "Failed"
                                    ? "text-[var(--error)]"
                                    : "text-[var(--text-muted)]"
                              }`}
                            >
                              {inst.status}
                            </span>
                            {inst.status === "Failed" && (
                              <button
                                onClick={() => handleRetryInstruction(inst.id)}
                                disabled={!!actionLoading}
                                className="text-xs rounded border border-[var(--border)] px-2 py-0.5 hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-50"
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Settlement Complete */}
          {settlement && (
            <div className="card p-6 border-green-500/30 bg-green-500/5">
              <h3 className="font-medium text-green-400 mb-4">Settlement Completed</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Amount Released</p>
                  <p className="font-bold text-lg">{settlement.reconciled_amount} XLM</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Date</p>
                  <p className="font-medium">{new Date(settlement.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Winners Paid</p>
                  <p className="font-medium">{payoutBatch?.payout_instructions.length ?? 0}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
        active
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "bg-[var(--bg-muted)] text-[var(--text-muted)] border-transparent"
      }`}
    >
      {label}
    </span>
  );
}
