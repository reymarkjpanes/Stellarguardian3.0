"use client";

/**
 * Event Escrow Page — Funding UX + Blockchain Transparency
 *
 * Design principles:
 * - Guided step-by-step flow with clear status at every stage
 * - Real blockchain data only — no mocks when live data is available
 * - Plain language for every Web3 action
 * - Duplicate submission prevention via in-flight lock
 * - One-click explorer links for contract, tx, and wallet verification
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
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

// ── Types ─────────────────────────────────────────────────────────────────────

type FundingStep =
  | "idle"
  | "wallet_select"
  | "connecting"
  | "connected"
  | "preparing"
  | "signing"
  | "broadcasting"
  | "confirming"
  | "done"
  | "error";

interface WalletInfo {
  provider: string;
  publicKey: string;
}

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

interface OnChainState {
  dbState: string;
  expectedBalance: string;
  contractAddress: string | null;
  walletAddress: string | null;
  network: string;
  inconsistent: boolean;
  onChainBalance: string;
  transaction: {
    hash: string;
    amount: string;
    status: string;
    fromAddress: string | null;
    ledger: number | null;
    blockTimestamp: string | null;
    confirmed: boolean;
  } | null;
  explorerLinks: {
    contract: string | null;
    transaction: string | null;
    wallet: string | null;
  };
}

// ── Step metadata ─────────────────────────────────────────────────────────────

const FUNDING_STEPS: { key: FundingStep; label: string; description: string }[] = [
  { key: "connecting", label: "Connect Wallet", description: "Opening your Stellar wallet" },
  {
    key: "preparing",
    label: "Prepare Transaction",
    description: "Building the deposit transaction",
  },
  {
    key: "signing",
    label: "Waiting for Signature",
    description: "Review and approve in your wallet",
  },
  { key: "broadcasting", label: "Broadcasting", description: "Sending to the Stellar network" },
  { key: "confirming", label: "Awaiting Confirmation", description: "Waiting for ledger finality" },
  { key: "done", label: "Escrow Funded", description: "Funds locked in the smart contract" },
];

const STEP_ORDER: FundingStep[] = [
  "connecting",
  "preparing",
  "signing",
  "broadcasting",
  "confirming",
  "done",
];

function stepIndex(step: FundingStep): number {
  return STEP_ORDER.indexOf(step);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventEscrowPage() {
  const { id: eventId } = useParams<{ id: string }>();

  // DB-backed state
  const [loading, setLoading] = useState(true);
  const [eventState, setEventState] = useState<string | null>(null);
  const [prizeBatch, setPrizeBatch] = useState<PrizeBatch | null>(null);
  const [escrow, setEscrow] = useState<EscrowAccount | null>(null);
  const [payoutBatch, setPayoutBatch] = useState<PayoutBatch | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  // Live on-chain state (fetched from /api/escrow/[id]/on-chain-state)
  const [onChain, setOnChain] = useState<OnChainState | null>(null);
  const [onChainLoading, setOnChainLoading] = useState(false);

  // Funding flow
  const [fundAmount, setFundAmount] = useState("");
  const [fundingStep, setFundingStep] = useState<FundingStep>("idle");
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  // In-flight lock — prevents duplicate submissions
  const fundingInFlight = useRef(false);

  // Other actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Wallet picker — shown when multiple adapters are available (H5)
  const [availableAdapters, setAvailableAdapters] = useState<
    Array<{ provider: string; connect: () => Promise<{ publicKey: string }> }>
  >([]);
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  // Live indicator
  const [liveFlash, setLiveFlash] = useState(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: evt }, { data: pb }] = await Promise.all([
        supabase.from("events").select("id, state").eq("id", eventId).single(),
        supabase
          .from("prize_allocation_batches")
          .select("id, event_id, status, total_amount")
          .eq("event_id", eventId)
          .eq("status", "Locked")
          .maybeSingle(),
      ]);

      if (!evt) return;
      setEventState(evt.state);
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

  const loadOnChainState = useCallback(async (escrowId: string) => {
    setOnChainLoading(true);
    try {
      const res = await fetch(`/api/escrow/${escrowId}/on-chain-state`);
      if (res.ok) setOnChain(await res.json());
    } catch {
      // Non-blocking — page still works without live data
    } finally {
      setOnChainLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load on-chain state whenever escrow changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (escrow?.id) void loadOnChainState(escrow.id);
  }, [escrow?.id, loadOnChainState]);

  // ── Real-time subscriptions ───────────────────────────────────────────────

  useEffect(() => {
    if (!eventId) return;
    const supabase = createBrowserClient();

    const flash = () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
      setLiveFlash(true);
      liveTimer.current = setTimeout(() => setLiveFlash(false), 1500);
      void loadData();
    };

    const channel = supabase
      .channel(`escrow-rt-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "escrow_accounts",
          filter: `event_id=eq.${eventId}`,
        },
        flash,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "payout_batches" }, flash)
      .on("postgres_changes", { event: "*", schema: "public", table: "payout_instructions" }, flash)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "settlements" }, flash)
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

  async function handleConnectWallet() {
    setFundingError(null);
    try {
      const { getAvailableAdapters } = await import("@/lib/wallet/registry");
      const adapters = await getAvailableAdapters();
      if (adapters.length === 0) {
        throw new Error(
          "No Stellar wallet detected. Install Freighter, xBull, or LOBSTR and try again.",
        );
      }
      // H5: if multiple wallets installed, show picker; otherwise connect directly
      if (adapters.length > 1) {
        setAvailableAdapters(adapters);
        setShowWalletPicker(true);
        return;
      }
      // Single wallet — connect immediately
      await connectWithAdapter(adapters[0]!);
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : "Wallet connection failed.");
      setFundingStep("error");
    }
  }

  async function connectWithAdapter(adapter: {
    provider: string;
    connect: () => Promise<{ publicKey: string }>;
  }) {
    setShowWalletPicker(false);
    setFundingStep("connecting");
    setFundingError(null);
    try {
      const { publicKey } = await adapter.connect();
      setWallet({ provider: adapter.provider, publicKey });
      setFundingStep("connected");
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : "Wallet connection failed.");
      setFundingStep("error");
    }
  }

  async function handleFundEscrow() {
    if (!escrow || !wallet || !fundAmount) return;
    // Prevent duplicate submissions
    if (fundingInFlight.current) return;
    fundingInFlight.current = true;

    const amountXlm = parseFloat(fundAmount);
    if (isNaN(amountXlm) || amountXlm <= 0) {
      setFundingError("Enter a valid amount greater than 0.");
      fundingInFlight.current = false;
      return;
    }

    setFundingError(null);
    setPendingTxHash(null);

    try {
      // Step: build transaction server-side
      setFundingStep("preparing");
      const amountStroops = BigInt(Math.round(amountXlm * 10_000_000));
      const buildRes = await fetch(`/api/escrow/${escrow.id}/build-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerPublicKey: wallet.publicKey,
          amountStroops: amountStroops.toString(),
        }),
      });
      if (!buildRes.ok) {
        const e = await buildRes.json();
        throw new Error(e.error?.message ?? "Failed to build deposit transaction.");
      }
      const { xdr: unsignedXdr } = await buildRes.json();

      // Step: wallet signature
      setFundingStep("signing");
      const { getAdapter } = await import("@/lib/wallet/registry");
      // Use the specific adapter the user selected/connected (H5)
      const adapter = wallet.provider
        ? getAdapter(wallet.provider as import("@/lib/wallet/types").WalletProvider)
        : undefined;
      if (!adapter) throw new Error("Wallet disconnected. Reconnect and try again.");
      const networkMode = escrow.network === "public" ? ("mainnet" as const) : ("testnet" as const);
      const signedXdr = await adapter.signTransaction(unsignedXdr, networkMode);

      // Step: broadcast to Stellar network
      setFundingStep("broadcasting");
      const submitRes = await fetch("/api/stellar/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
      });
      if (!submitRes.ok) {
        const e = await submitRes.json();
        throw new Error(e.error ?? "Transaction submission failed.");
      }
      const { hash } = await submitRes.json();
      setPendingTxHash(hash);

      // Step: awaiting ledger confirmation (brief visual pause, then verify)
      setFundingStep("confirming");
      await new Promise((r) => setTimeout(r, 2500));

      setFundingStep("done");
      setFundAmount("");
      // Reload DB + on-chain state after confirmation
      await loadData();
      if (escrow.id) await loadOnChainState(escrow.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Funding failed.";
      // User rejection is a normal flow — don't show as error
      if (
        msg.toLowerCase().includes("reject") ||
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("denied")
      ) {
        setFundingStep("connected");
        setFundingError("Transaction was cancelled. You can try again.");
      } else {
        setFundingError(msg);
        setFundingStep("error");
      }
    } finally {
      fundingInFlight.current = false;
    }
  }

  async function handleVerifyFunding() {
    if (!escrow) return;
    setActionLoading("verify");
    setActionError(null);
    try {
      await verifyFundingAction(escrow.id);
      await loadData();
      await loadOnChainState(escrow.id);
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
      setSimulationResult(res as unknown as SimulationResult);
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
    setActionLoading(`retry-${instructionId}`);
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

  function resetFundingFlow() {
    setFundingStep("idle");
    setFundingError(null);
    setPendingTxHash(null);
  }

  // ── Render: loading skeleton ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse p-6">
        <div className="h-5 w-40 rounded bg-[var(--bg-muted)]" />
        <div className="h-28 rounded-xl bg-[var(--bg-muted)]" />
        <div className="h-48 rounded-xl bg-[var(--bg-muted)]" />
        <div className="h-36 rounded-xl bg-[var(--bg-muted)]" />
      </div>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isFundingActive = !["idle", "done"].includes(fundingStep) && fundingStep !== "error";
  const isFunded = ["Funded", "Verified", "Locked", "Releasing", "Completed"].includes(
    escrow?.status ?? "",
  );
  const explorerNetwork = onChain?.network ?? escrow?.network ?? "testnet";

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <BackButton href={`/events/${eventId}`} label="Back to Event" />
        {/* Live indicator */}
        <span
          className={`inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-opacity ${liveFlash ? "opacity-100" : "opacity-40"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full bg-green-400 ${liveFlash ? "animate-ping" : ""}`}
          />
          Live
        </span>
      </div>

      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Escrow & Prize Disbursement
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Funds are held in a Soroban smart contract on Stellar — transparent, verifiable, and
          tamper-proof.
        </p>
      </div>

      {/* Global action error */}
      {actionError && (
        <div
          className="rounded-lg border border-[var(--error)]/40 bg-[var(--error-bg)] px-4 py-3 flex items-start justify-between gap-3"
          role="alert"
        >
          <p className="text-sm text-[var(--error)]">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-xs text-[var(--error)] hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Inconsistency warning */}
      {onChain?.inconsistent && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <p className="text-sm font-medium text-amber-400">⚠ Balance mismatch detected</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            On-chain: <span className="font-mono">{onChain.onChainBalance} XLM</span> · Expected:{" "}
            <span className="font-mono">{onChain.expectedBalance} XLM</span>. Automated transitions
            are paused. Contact platform support if this persists.
          </p>
        </div>
      )}

      {/* Automated Trigger Banner */}
      {(eventState === "WinnerVerification" || eventState === "PrizeApproved") && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/8 px-4 py-3 flex items-start gap-3">
          <div className="text-blue-400 mt-0.5">ℹ</div>
          <div>
            <p className="text-sm font-medium text-blue-400">Automated Trigger Standby</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {eventState === "WinnerVerification"
                ? "The event is in Winner Verification. Once disputes are cleared and the state transitions to Prize Approved, the smart contract will automatically trigger payouts."
                : "The prize allocation has been approved. Automated escrow payout will execute momentarily, or you can track progress below."}
            </p>
          </div>
        </div>
      )}

      {/* ── Workflow progress stepper ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Financial Workflow</h3>
          <span className="text-xs text-[var(--text-muted)]">
            {settlement
              ? "Complete"
              : escrow
                ? `Step ${isFunded ? "3–7" : "2"} of 7`
                : "Step 1 of 7"}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[
            { label: "Prize Batch", done: !!prizeBatch },
            { label: "Escrow Created", done: !!escrow },
            { label: "Funded", done: isFunded },
            {
              label: "Simulated",
              done: [
                "Preparing",
                "Signing",
                "Broadcast",
                "Confirmed",
                "Partially Completed",
              ].includes(payoutBatch?.status ?? ""),
            },
            {
              label: "Broadcast",
              done: ["Broadcast", "Confirmed", "Partially Completed"].includes(
                payoutBatch?.status ?? "",
              ),
            },
            {
              label: "Confirmed",
              done: ["Confirmed", "Partially Completed"].includes(payoutBatch?.status ?? ""),
            },
            { label: "Settled", done: !!settlement },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`h-2 w-full rounded-full transition-colors ${s.done ? "bg-[var(--accent)]" : "bg-[var(--bg-muted)]"}`}
              />
              <span className="text-[9px] text-[var(--text-muted)] text-center leading-tight hidden sm:block">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── No prize batch yet ── */}
      {!prizeBatch && (
        <div className="mb-4">
          <EmptyState
            title="Prize allocation not locked yet"
            description="Complete judging and lock the prize allocation batch before initializing escrow."
          />
        </div>
      )}

      {/* ── Prize batch locked — create escrow ── */}
      {prizeBatch && !escrow && (
        <div className="card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center text-base shrink-0">
              🔒
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Ready to create escrow</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Prize batch is locked at <strong>{prizeBatch.total_amount ?? 0} XLM</strong>.
                Creating the escrow deploys your Soroban smart contract on Stellar {explorerNetwork}
                .
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateEscrow}
            disabled={!!actionLoading}
            className="btn-primary px-5 py-2.5 rounded-md text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {actionLoading === "create" ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Deploying contract…
              </span>
            ) : (
              "Create Escrow Smart Contract"
            )}
          </button>
        </div>
      )}

      {/* ── Escrow exists ── */}
      {escrow && (
        <div className="space-y-6">
          {/* Contract summary card */}
          <div className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoCell label="Escrow Status" value={<StatusBadge status={escrow.status} />} />
            <InfoCell
              label="Network"
              value={
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${escrow.network === "mainnet" ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {escrow.network}
                </span>
              }
            />
            <InfoCell label="Target" value={`${escrow.expected_balance} XLM`} mono />
            <InfoCell
              label="On-Chain Balance"
              value={
                onChainLoading ? (
                  <span className="text-[var(--text-muted)]">…</span>
                ) : (
                  `${onChain?.onChainBalance ?? "—"} XLM`
                )
              }
              mono
              highlight={
                onChain && parseFloat(onChain.onChainBalance) >= parseFloat(escrow.expected_balance)
              }
            />
            {escrow.contract_address && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-[10px] text-[var(--text-muted)] mb-1">Contract Address</p>
                <div className="flex items-center gap-2 bg-[var(--bg-muted)] rounded-md px-3 py-2">
                  <code className="text-xs font-mono text-[var(--text)] break-all flex-1">
                    {escrow.contract_address}
                  </code>
                  <CopyButton value={escrow.contract_address} />
                </div>
              </div>
            )}
            {onChain?.walletAddress && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-[10px] text-[var(--text-muted)] mb-1">Escrow Wallet Address</p>
                <div className="flex items-center gap-2 bg-[var(--bg-muted)] rounded-md px-3 py-2">
                  <code className="text-xs font-mono text-[var(--text)] break-all flex-1">
                    {onChain.walletAddress}
                  </code>
                  <CopyButton value={onChain.walletAddress} />
                </div>
              </div>
            )}
          </div>

          {/* Explorer links */}
          {(onChain?.explorerLinks.contract ||
            onChain?.explorerLinks.wallet ||
            onChain?.explorerLinks.transaction) && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Verify On-Chain
              </p>
              <div className="flex flex-wrap gap-2">
                {onChain.explorerLinks.contract && (
                  <ExplorerLink
                    href={onChain.explorerLinks.contract}
                    label="View Contract"
                    icon="📄"
                  />
                )}
                {onChain.explorerLinks.wallet && (
                  <ExplorerLink href={onChain.explorerLinks.wallet} label="View Wallet" icon="👛" />
                )}
                {onChain.explorerLinks.transaction && (
                  <ExplorerLink
                    href={onChain.explorerLinks.transaction}
                    label="View Transaction"
                    icon="🔗"
                  />
                )}
                {pendingTxHash && !onChain?.explorerLinks.transaction && (
                  <ExplorerLink
                    href={`https://stellar.expert/explorer/${explorerNetwork}/tx/${pendingTxHash}`}
                    label="View Latest Transaction"
                    icon="🔗"
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Funding section (only when escrow not yet funded) ── */}
          {!isFunded && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">Fund the Escrow</h3>
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-0.5 rounded-full">
                  {wallet
                    ? `Connected: ${wallet.publicKey.slice(0, 6)}…${wallet.publicKey.slice(-4)}`
                    : "Wallet not connected"}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Funds are sent directly into the Soroban smart contract, not to a wallet address.
                Once deposited, they are locked until prize disbursement is approved.
              </p>

              {/* Funding step progress indicator */}
              {fundingStep !== "idle" && fundingStep !== "error" && (
                <FundingStepProgress currentStep={fundingStep} />
              )}

              {/* Funding error */}
              {fundingError && (
                <div className="rounded-lg border border-[var(--error)]/40 bg-[var(--error-bg)] px-4 py-3 space-y-2">
                  <p className="text-sm text-[var(--error)]">{fundingError}</p>
                  <button
                    onClick={resetFundingFlow}
                    className="text-xs font-medium text-[var(--error)] hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Step 1: Connect wallet — with multi-wallet picker (H5) */}
              {fundingStep === "idle" && !wallet && !showWalletPicker && (
                <button
                  onClick={handleConnectWallet}
                  className="btn-primary px-5 py-2.5 rounded-md text-sm font-medium w-full sm:w-auto"
                >
                  Connect Stellar Wallet
                </button>
              )}

              {/* H5: Wallet picker — shown when >1 wallet is installed */}
              {showWalletPicker && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--text)]">
                    Multiple wallets detected — choose one to connect:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableAdapters.map((adapter) => (
                      <button
                        key={adapter.provider}
                        onClick={() => connectWithAdapter(adapter)}
                        className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-left text-sm font-medium text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors"
                      >
                        <span className="h-7 w-7 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-xs font-bold shrink-0">
                          {adapter.provider.charAt(0)}
                        </span>
                        {adapter.provider}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowWalletPicker(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Step 2: Enter amount + fund */}
              {(fundingStep === "idle" || fundingStep === "connected") && wallet && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                      Amount to deposit (XLM)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max={escrow.expected_balance}
                        step="any"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(e.target.value)}
                        placeholder={`Target: ${escrow.expected_balance}`}
                        disabled={isFundingActive}
                        className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)] disabled:opacity-50"
                      />
                      <button
                        onClick={handleFundEscrow}
                        disabled={!fundAmount || isFundingActive}
                        className="btn-primary px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                      >
                        {isFundingActive ? (
                          <span className="flex items-center gap-2">
                            <Spinner />
                            Working…
                          </span>
                        ) : (
                          "Fund Escrow"
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                      Your wallet will prompt you to review and sign this Stellar transaction.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setWallet(null);
                      setFundingStep("idle");
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Disconnect wallet
                  </button>
                </div>
              )}

              {/* Step 3: Success — verify */}
              {fundingStep === "done" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-green-500/30 bg-green-500/8 px-4 py-3">
                    <p className="text-sm font-medium text-green-400">
                      ✓ Transaction broadcast successfully
                    </p>
                    {pendingTxHash && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                        Hash: {pendingTxHash.slice(0, 16)}…{pendingTxHash.slice(-8)}
                      </p>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Click below to confirm the funds were received by the contract.
                    </p>
                  </div>
                  <button
                    onClick={handleVerifyFunding}
                    disabled={!!actionLoading}
                    className="btn-primary px-5 py-2.5 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {actionLoading === "verify" ? (
                      <span className="flex items-center gap-2">
                        <Spinner />
                        Verifying…
                      </span>
                    ) : (
                      "Confirm Funding On-Chain"
                    )}
                  </button>
                </div>
              )}

              {/* Manual verify fallback (always available while not funded) */}
              {fundingStep === "idle" && wallet && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    Already sent funds manually?
                  </p>
                  <button
                    onClick={handleVerifyFunding}
                    disabled={!!actionLoading}
                    className="btn-secondary px-4 py-2 rounded-md text-xs disabled:opacity-50"
                  >
                    {actionLoading === "verify" ? "Verifying…" : "Verify Funding On-Chain"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Transaction details card (shown after first confirmed tx) ── */}
          {onChain?.transaction && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Latest Funding Transaction
                </p>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    onChain.transaction.confirmed
                      ? "bg-green-500/15 text-green-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {onChain.transaction.confirmed ? "Confirmed" : "Pending"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                <TxCell label="Amount" value={`${onChain.transaction.amount} XLM`} mono />
                <TxCell label="Token" value="XLM (Native)" />
                <TxCell label="Network" value={onChain.network} />
                {onChain.transaction.ledger && (
                  <TxCell label="Ledger Number" value={String(onChain.transaction.ledger)} mono />
                )}
                {onChain.transaction.blockTimestamp && (
                  <TxCell
                    label="Block Timestamp"
                    value={new Date(onChain.transaction.blockTimestamp).toLocaleString()}
                  />
                )}
                {onChain.transaction.fromAddress && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">Funding Wallet</p>
                    <div className="flex items-center gap-2 bg-[var(--bg-muted)] rounded px-2.5 py-1.5">
                      <code className="text-xs font-mono text-[var(--text)] flex-1 break-all">
                        {onChain.transaction.fromAddress}
                      </code>
                      <CopyButton value={onChain.transaction.fromAddress} />
                    </div>
                  </div>
                )}
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-[10px] text-[var(--text-muted)] mb-1">Transaction Hash</p>
                  <div className="flex items-center gap-2 bg-[var(--bg-muted)] rounded px-2.5 py-1.5">
                    <code className="text-xs font-mono text-[var(--text)] flex-1 break-all">
                      {onChain.transaction.hash}
                    </code>
                    <CopyButton value={onChain.transaction.hash} />
                    {onChain.explorerLinks.transaction && (
                      <a
                        href={onChain.explorerLinks.transaction}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--accent)] hover:underline shrink-0"
                      >
                        Explorer ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Payout execution section ── */}
          {isFunded && payoutBatch && !settlement && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">Payout Execution</h3>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[var(--border)]">
                <InfoCell
                  label="Batch Status"
                  value={<StatusBadge status={payoutBatch.status} />}
                />
                <InfoCell label="Total Payouts" value={`${payoutBatch.total_amount} XLM`} mono />
              </div>

              {simulationResult && (
                <div
                  className={`rounded-lg p-3 text-sm space-y-1 ${simulationResult.success ? "bg-green-500/8 border border-green-500/20" : "bg-[var(--error-bg)] border border-[var(--error)]/30"}`}
                >
                  <p
                    className={`font-medium text-xs ${simulationResult.success ? "text-green-400" : "text-[var(--error)]"}`}
                  >
                    {simulationResult.success ? "✓ Simulation passed" : "✗ Simulation failed"}
                  </p>
                  {simulationResult.estimatedFee && (
                    <p className="text-xs text-[var(--text-muted)]">
                      Estimated fee: {simulationResult.estimatedFee} XLM
                    </p>
                  )}
                  {simulationResult.error && (
                    <p className="text-xs text-[var(--error)]">{simulationResult.error}</p>
                  )}
                </div>
              )}

              {/* Automation Status Banner */}
              {(eventState === "PrizeApproved" || eventState === "EscrowRelease") && (
                <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 mb-4 flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]"></span>
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--accent)]">
                      Automated Payout System Active
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {eventState === "PrizeApproved"
                        ? "Waiting for all disputes to be resolved. Once disputes are clear, payouts will execute automatically."
                        : "Payout execution is currently in progress on-chain."}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {["Pending", "Preparing"].includes(payoutBatch.status) && (
                  <button
                    onClick={handleSimulate}
                    disabled={!!actionLoading}
                    className="btn-secondary px-4 py-2 rounded-md text-sm disabled:opacity-50"
                  >
                    {actionLoading === "simulate" ? (
                      <span className="flex items-center gap-2">
                        <Spinner />
                        Simulating…
                      </span>
                    ) : (
                      "Simulate Payout"
                    )}
                  </button>
                )}
                {["Preparing", "Signing"].includes(payoutBatch.status) &&
                  simulationResult?.success && (
                    <button
                      onClick={handleRelease}
                      disabled={
                        !!actionLoading ||
                        eventState === "PrizeApproved" ||
                        eventState === "EscrowRelease"
                      }
                      className="rounded-md bg-green-600 text-white px-5 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === "release" ? (
                        <span className="flex items-center gap-2">
                          <Spinner />
                          Broadcasting…
                        </span>
                      ) : (
                        "Release & Disburse Prizes"
                      )}
                    </button>
                  )}
                {["Confirmed", "Partially Completed"].includes(payoutBatch.status) && (
                  <button
                    onClick={handleSettle}
                    disabled={!!actionLoading}
                    className="btn-primary px-4 py-2 rounded-md text-sm disabled:opacity-50"
                  >
                    {actionLoading === "settle" ? "Settling…" : "Record Settlement"}
                  </button>
                )}
              </div>

              {/* Per-winner execution progress */}
              {["Broadcast", "Confirmed", "Partially Completed", "Failed"].includes(
                payoutBatch.status,
              ) && (
                <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-[var(--bg-muted)] border-b border-[var(--border)]">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                      Disbursement Progress
                    </p>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {payoutBatch.payout_instructions.map((inst) => (
                      <div key={inst.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <code className="font-mono text-[10px] text-[var(--text-muted)] flex-1 truncate">
                          {inst.destination_address.slice(0, 8)}…
                          {inst.destination_address.slice(-6)}
                        </code>
                        <span className="text-xs font-medium text-[var(--text)] shrink-0">
                          {inst.amount} XLM
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            inst.status === "Confirmed"
                              ? "bg-green-500/15 text-green-400"
                              : inst.status === "Failed"
                                ? "bg-[var(--error-bg)] text-[var(--error)]"
                                : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                          }`}
                        >
                          {inst.status}
                        </span>
                        {inst.status === "Failed" && (
                          <button
                            onClick={() => handleRetryInstruction(inst.id)}
                            disabled={!!actionLoading}
                            className="text-[10px] border border-[var(--border)] rounded px-2 py-0.5 hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-50 shrink-0"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Settlement complete ── */}
          {settlement && (
            <div className="card p-6 border border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-green-400 text-lg">✓</span>
                <h3 className="text-sm font-semibold text-green-400">Settlement Complete</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <InfoCell
                  label="Amount Released"
                  value={`${settlement.reconciled_amount} XLM`}
                  mono
                  highlight
                />
                <InfoCell
                  label="Winners Paid"
                  value={String(payoutBatch?.payout_instructions.length ?? 0)}
                />
                <InfoCell
                  label="Settled At"
                  value={new Date(settlement.created_at).toLocaleString()}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FundingStepProgress({ currentStep }: { currentStep: FundingStep }) {
  const current = stepIndex(currentStep);
  return (
    <div className="space-y-2">
      {FUNDING_STEPS.map((s, i) => {
        const idx = stepIndex(s.key);
        const isActive = idx === current;
        const isDone = idx < current || currentStep === "done";
        return (
          <div
            key={s.key}
            className={`flex items-center gap-3 transition-opacity ${idx > current ? "opacity-30" : "opacity-100"}`}
          >
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                isDone
                  ? "bg-green-500 text-white"
                  : isActive
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              }`}
            >
              {isDone ? "✓" : isActive ? <span className="animate-pulse">●</span> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-medium ${isActive ? "text-[var(--text)]" : isDone ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}
              >
                {s.label}
              </p>
              {isActive && <p className="text-[10px] text-[var(--text-muted)]">{s.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = ["Funded", "Verified", "Locked", "Completed"].includes(status)
    ? "text-green-400 bg-green-500/15"
    : ["Releasing", "Broadcast"].includes(status)
      ? "text-blue-400 bg-blue-500/15"
      : ["Failed", "Refunded"].includes(status)
        ? "text-[var(--error)] bg-[var(--error-bg)]"
        : "text-[var(--text-muted)] bg-[var(--bg-muted)]";
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}
    >
      {status}
    </span>
  );
}

function InfoCell({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean | null;
}) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</p>
      <p
        className={`text-sm font-medium ${mono ? "font-mono" : ""} ${highlight ? "text-green-400" : "text-[var(--text)]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function TxCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</p>
      <p className={`text-xs text-[var(--text)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function ExplorerLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
    >
      <span>{icon}</span>
      {label}
      <span className="text-[var(--text-muted)]">↗</span>
    </a>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? "✓" : "Copy"}
    </button>
  );
}

function Spinner() {
  return (
    <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
  );
}
