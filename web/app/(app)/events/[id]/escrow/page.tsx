/**
 * Event escrow page — funding progress, verification, disbursement controls.
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

export default function EventEscrowPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [escrow, setEscrow] = useState<EscrowData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [eventState, setEventState] = useState("");

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: event }, { data: membership }, { data: escrowData }, { data: txs }] = await Promise.all([
      supabase.from("events").select("state, prize_pool_target, network_mode").eq("id", eventId).single(),
      supabase.from("event_members").select("role").eq("event_id", eventId).eq("user_id", user.id).maybeSingle(),
      supabase.from("escrow_accounts").select("*").eq("event_id", eventId).maybeSingle(),
      supabase.from("transactions").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
    ]);

    setEventState(event?.state ?? "");
    setUserRole(membership?.role ?? null);
    setEscrow(escrowData ?? null);
    setTransactions(txs ?? []);
    setLoading(false);
  }

  async function handleVerifyOnChain() {
    const res = await fetch(`/api/events/${eventId}/verify-escrow`);
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
    loadData();
  }

  const isOrganizer = userRole === "Organizer";

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

      {!escrow ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No escrow account has been created for this event yet.
          </p>
          {isOrganizer && eventState === "OrganizerFundsEscrow" && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              The escrow account will be generated when you initiate funding.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Escrow status */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text)]">Escrow Account</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                escrow.state === "FullyFunded" || escrow.state === "Locked"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
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
                  {escrow.funding_wallet ?? "Not set"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Expected Balance</p>
                <p className="text-lg font-semibold text-[var(--text)]">
                  {escrow.expected_balance ?? 0} XLM
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Last Reconciled</p>
                <p className="text-lg font-semibold text-[var(--text)]">
                  {escrow.last_reconciled_balance ?? 0} XLM
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleVerifyOnChain}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                Verify On-Chain
              </button>
              {isOrganizer && escrow.state === "PendingFunding" && (
                <button
                  className="btn-primary px-4 py-2 text-sm font-medium rounded-md"
                  onClick={() => alert("Funding flow: Sign transaction with your wallet to fund the escrow.")}
                >
                  Fund Escrow
                </button>
              )}
            </div>
          </div>

          {/* Transactions */}
          {transactions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text)] mb-3">Transactions</h3>
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="card p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text)] capitalize">{tx.type}</p>
                      <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                        {tx.tx_hash?.slice(0, 12)}...{tx.tx_hash?.slice(-8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[var(--text)]">{tx.amount} XLM</p>
                      <p className="text-xs text-[var(--text-muted)]">{tx.status}</p>
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
