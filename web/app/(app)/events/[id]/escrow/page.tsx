/**
 * Event escrow page — funding, verification, disbursement, and refund controls.
 *
 * Implements the complete financial workflow:
 * 1. Fund Escrow: Freighter wallet signing → submit to Horizon → POST /api/events/[id]/fund
 * 2. Verify On-Chain: GET /api/events/[id]/verify-escrow
 * 3. Disburse Prizes: POST /api/events/[id]/disburse (idempotent)
 * 4. Refund: POST /api/events/[id]/refund (idempotent)
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface EscrowData {
  id: string;
  stellar_public_key: string;
  state: string;
  expected_balance: number | null;
  last_reconciled_balance: number | null;
  funding_wallet: string | null;
  inconsistent: boolean;
}

interface Transaction {
  id: string;
  type: string;
  tx_hash: string;
  amount: number;
  status: string;
  created_at: string;
}

type FundingStep = "idle" | "connecting" | "building" | "signing" | "submitting" | "verifying" | "done" | "error";

export default function EventEscrowPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [escrow, setEscrow] = useState<EscrowData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [eventState, setEventState] = useState("");
  const [prizePoolTarget, setPrizePoolTarget] = useState<number>(0);
  const [networkMode, setNetworkMode] = useState<string>("testnet");

  // Funding flow state
  const [fundingStep, setFundingStep] = useState<FundingStep>("idle");
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("");

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { loadData(); }, [eventId]);

  async function loadData() {
    try {
      const supabase = createBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const [{ data: event }, { data: membership }, { data: escrowData }, { data: txs }] = await Promise.all([
        supabase.from("events").select("state, prize_pool_target, network_mode").eq("id", eventId).single(),
        supabase.from("event_members").select("role").eq("event_id", eventId).eq("user_id", user.id).maybeSingle(),
        supabase.from("escrow_accounts").select("*").eq("event_id", eventId).maybeSingle(),
        supabase.from("transactions").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      ]);

      setEventState(event?.state ?? "");
      setPrizePoolTarget(Number(event?.prize_pool_target ?? 0));
      setNetworkMode(event?.network_mode ?? "testnet");
      setUserRole(membership?.role ?? null);
      setEscrow(escrowData ?? null);
      setTransactions(txs ?? []);
    } catch (err) {
      console.error("Failed to load escrow data:", err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Complete escrow funding flow:
   * 1. Connect Freighter wallet
   * 2. Build XLM payment transaction (client-side via Stellar SDK)
   * 3. Sign with Freighter
   * 4. Submit to Horizon
   * 5. Call POST /api/events/[id]/fund with tx hash for verification
   */
  async function handleFundEscrow() {
    if (!escrow || !fundAmount) return;
    setFundingStep("connecting");
    setFundingError(null);

    try {
      // Step 1: Import Freighter adapter and connect
      const { FreighterAdapter } = await import("@/lib/wallet/freighter");
      const wallet = new FreighterAdapter();

      const available = await wallet.isAvailable();
      if (!available) {
        throw new Error("Freighter wallet extension is not installed. Please install it from freighter.app");
      }

      const { publicKey, network } = await wallet.connect();

      if (network !== networkMode) {
        throw new Error(`Wallet is connected to ${network} but this event uses ${networkMode}. Please switch networks in Freighter.`);
      }

      // Step 2: Build the payment transaction
      setFundingStep("building");
      const { Horizon, TransactionBuilder, Operation, Asset, Networks } = await import("@stellar/stellar-sdk");

      const horizonUrl = networkMode === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";
      const networkPassphrase = networkMode === "mainnet"
        ? Networks.PUBLIC
        : Networks.TESTNET;

      const server = new Horizon.Server(horizonUrl);
      const sourceAccount = await server.loadAccount(publicKey);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase,
      })
        .addOperation(Operation.payment({
          destination: escrow.stellar_public_key,
          asset: Asset.native(),
          amount: fundAmount,
        }))
        .setTimeout(60)
        .build();

      // Step 3: Sign with Freighter
      setFundingStep("signing");
      const signedXdr = await wallet.signTransaction(transaction.toXDR(), networkMode as "testnet" | "mainnet");

      // Step 4: Submit to Horizon
      setFundingStep("submitting");
      const { TransactionBuilder: TxBuilder2 } = await import("@stellar/stellar-sdk");
      const signedTx = TxBuilder2.fromXDR(signedXdr, networkPassphrase);
      const submitResult = await server.submitTransaction(signedTx);

      if (!submitResult.successful) {
        throw new Error("Transaction submission failed on Horizon.");
      }

      // Step 5: Verify with our API
      setFundingStep("verifying");
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/events/${eventId}/fund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          txHash: submitResult.hash,
          fundingWallet: publicKey,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error?.message ?? "Funding verification failed.");
      }

      setFundingStep("done");
      setFundAmount("");
      loadData();
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : "Funding failed.");
      setFundingStep("error");
    }
  }

  async function handleVerifyOnChain() {
    setActionLoading("verify");
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/verify-escrow`);
      const data = await res.json();
      setVerifyResult(data);
      loadData();
    } catch {
      setActionError("Verification failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisburse() {
    if (!confirm("Disburse prizes to all winners? This action is irreversible once confirmed on-chain.")) return;
    setActionLoading("disburse");
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/disburse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
      });
      if (!res.ok) {
        const { error } = await res.json();
        setActionError(error?.message ?? "Disbursement failed.");
        return;
      }
      loadData();
    } catch {
      setActionError("Network error during disbursement.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefund() {
    if (!confirm("Refund all escrow funds back to the organizer? This cannot be undone.")) return;
    setActionLoading("refund");
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
      });
      if (!res.ok) {
        const { error } = await res.json();
        setActionError(error?.message ?? "Refund failed.");
        return;
      }
      loadData();
    } catch {
      setActionError("Network error during refund.");
    } finally {
      setActionLoading(null);
    }
  }

  const isOrganizer = userRole === "Organizer";
  const canFund = isOrganizer && escrow?.state === "PendingFunding";
  const canDisburse = isOrganizer && (escrow?.state === "Locked" || escrow?.state === "FullyFunded") && eventState === "PrizeDistribution";
  const canRefund = isOrganizer && escrow && !["Released", "Refunded"].includes(escrow.state) && eventState === "Cancelled";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-[var(--bg-muted)] rounded animate-pulse" />
        <div className="h-24 bg-[var(--bg-muted)] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Escrow & Funding</h2>

      {actionError && (
        <div className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3" role="alert">
          <p className="text-sm text-[var(--error)]">{actionError}</p>
        </div>
      )}

      {!escrow ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No escrow account has been created for this event yet.
          </p>
          {isOrganizer && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              The escrow account will be generated when the event reaches the funding phase.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Escrow status card */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text)]">Escrow Account</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                escrow.state === "FullyFunded" || escrow.state === "Locked"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : escrow.state === "Released"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  : escrow.inconsistent
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              }`}>
                {escrow.inconsistent ? "⚠ Inconsistent" : escrow.state}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Public Key</p>
                <p className="text-xs font-mono text-[var(--text-secondary)] break-all mt-0.5">
                  {escrow.stellar_public_key}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Funding Wallet</p>
                <p className="text-xs font-mono text-[var(--text-secondary)] break-all mt-0.5">
                  {escrow.funding_wallet ?? "Not yet funded"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Target</p>
                <p className="text-lg font-semibold text-[var(--text)]">{prizePoolTarget} XLM</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Expected Balance</p>
                <p className="text-lg font-semibold text-[var(--text)]">{escrow.expected_balance ?? 0} XLM</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">On-Chain Balance</p>
                <p className="text-lg font-semibold text-[var(--text)]">{escrow.last_reconciled_balance ?? 0} XLM</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-[var(--border)]">
              <button
                onClick={handleVerifyOnChain}
                disabled={actionLoading === "verify"}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-50"
              >
                {actionLoading === "verify" ? "Verifying…" : "Verify On-Chain"}
              </button>
              {canDisburse && (
                <button
                  onClick={handleDisburse}
                  disabled={actionLoading === "disburse"}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "disburse" ? "Disbursing…" : "Disburse Prizes"}
                </button>
              )}
              {canRefund && (
                <button
                  onClick={handleRefund}
                  disabled={actionLoading === "refund"}
                  className="rounded-md border border-[var(--error)] px-4 py-2 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors disabled:opacity-50"
                >
                  {actionLoading === "refund" ? "Refunding…" : "Refund to Organizer"}
                </button>
              )}
            </div>
          </div>

          {/* Funding flow */}
          {canFund && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-medium text-[var(--text)]">Fund Escrow</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Send XLM from your Freighter wallet to the escrow account. The transaction will
                be signed by your wallet and submitted to the Stellar {networkMode} network.
              </p>

              {fundingStep === "idle" || fundingStep === "error" ? (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label htmlFor="fund-amount" className="block text-xs text-[var(--text-muted)] mb-1">
                      Amount (XLM)
                    </label>
                    <input
                      id="fund-amount"
                      type="number"
                      min="1"
                      step="0.01"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder={String(prizePoolTarget)}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <button
                    onClick={handleFundEscrow}
                    disabled={!fundAmount || Number(fundAmount) <= 0}
                    className="btn-primary px-5 py-2 text-sm font-medium rounded-md disabled:opacity-50"
                  >
                    Fund with Freighter
                  </button>
                </div>
              ) : fundingStep === "done" ? (
                <div className="rounded-md bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-4 py-3">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    ✓ Funding successful! Transaction verified on-chain.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <FundingProgress step={fundingStep} />
                </div>
              )}

              {fundingError && (
                <div className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3">
                  <p className="text-sm text-[var(--error)]">{fundingError}</p>
                  <button
                    onClick={() => { setFundingStep("idle"); setFundingError(null); }}
                    className="mt-2 text-xs text-[var(--error)] underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Verification result */}
          {verifyResult && (
            <div className="card p-4">
              <h3 className="text-sm font-medium text-[var(--text)] mb-2">Verification Result</h3>
              <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-muted)] rounded p-3 overflow-x-auto">
                {JSON.stringify(verifyResult, null, 2)}
              </pre>
              <button onClick={() => setVerifyResult(null)} className="mt-2 text-xs text-[var(--text-muted)] hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Transaction history */}
          {transactions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text)] mb-3">Transaction History</h3>
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="card p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text)] capitalize">{tx.type}</p>
                      <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                        {tx.tx_hash?.slice(0, 12)}…{tx.tx_hash?.slice(-8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[var(--text)]">{tx.amount} XLM</p>
                      <p className={`text-xs ${tx.status === "confirmed" ? "text-green-600" : "text-[var(--text-muted)]"}`}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Visual progress indicator for the multi-step funding flow. */
function FundingProgress({ step }: { step: FundingStep }) {
  const steps: { key: FundingStep; label: string }[] = [
    { key: "connecting", label: "Connecting wallet…" },
    { key: "building", label: "Building transaction…" },
    { key: "signing", label: "Waiting for signature…" },
    { key: "submitting", label: "Submitting to Stellar…" },
    { key: "verifying", label: "Verifying on-chain…" },
  ];

  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const stepIndex = steps.findIndex((x) => x.key === step);
        const isCurrent = s.key === step;
        const isDone = i < stepIndex;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium ${
              isDone ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : isCurrent ? "bg-[var(--accent)] text-white animate-pulse"
              : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
            }`}>
              {isDone ? "✓" : i + 1}
            </div>
            <span className={`text-sm ${isCurrent ? "text-[var(--text)] font-medium" : isDone ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
