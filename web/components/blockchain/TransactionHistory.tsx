"use client";

/**
 * TransactionHistory — paginated on-chain transaction history for an event.
 *
 * Design: data-dense list with monospace hashes, status pills, and
 * explorer links. Uses the existing card/border token system.
 * Loading, empty, and error states are each explicitly handled.
 *
 * Source: GET /api/events/[id]/transactions (cursor-paginated)
 * React Query v5 — first page fetched via useQuery, subsequent pages
 * appended via a manual fetch triggered by the "Load more" button.
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface Transaction {
  id: string;
  type: "fund" | "disbursement" | "refund" | string;
  tx_hash: string;
  amount: string;
  from_address: string | null;
  to_address: string | null;
  status: "confirmed" | "pending" | "failed" | string;
  network_mode: string;
  created_at: string;
}

interface PageResult {
  rows: Transaction[];
  cursor: string | null;
  hasMore: boolean;
}

interface TransactionHistoryProps {
  eventId: string;
  /** Override explorer base URL — defaults to testnet */
  explorerBase?: string;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  fund: "Deposit",
  disbursement: "Prize Payment",
  refund: "Refund",
};

const STATUS_STYLES: Record<string, string> = {
  confirmed:
    "bg-[var(--success-bg,oklch(0.97_0.02_145))] text-[var(--success,oklch(0.55_0.15_145))]",
  pending: "bg-[var(--bg-muted)] text-[var(--text-muted)]",
  failed:
    "bg-[var(--error-bg,oklch(0.98_0.01_25))] text-[var(--error,oklch(0.55_0.2_25))]",
};

function buildExplorerUrl(hash: string, network: string, base?: string): string {
  if (base) return `${base}/${hash}`;
  const root =
    network === "mainnet"
      ? "https://stellar.expert/explorer/public/tx"
      : "https://stellar.expert/explorer/testnet/tx";
  return `${root}/${hash}`;
}

function formatAmount(amount: string): string {
  const n = Number(amount);
  return isNaN(n)
    ? amount
    : `${n.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

async function fetchTransactions(eventId: string, cursor?: string): Promise<PageResult> {
  const url = new URL(`/api/events/${eventId}/transactions`, window.location.origin);
  url.searchParams.set("limit", "15");
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load transactions.");

  const json = await res.json();
  return {
    rows: (json.data ?? []) as Transaction[],
    cursor: json.pagination?.cursor ?? null,
    hasMore: json.pagination?.hasMore ?? false,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransactionHistory({ eventId, explorerBase }: TransactionHistoryProps) {
  // Extra pages beyond the first (loaded via "Load more" click)
  const [extraPages, setExtraPages] = useState<Transaction[][]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  // First page — React Query v5
  const { data: firstPage, isPending, error } = useQuery<PageResult>({
    queryKey: ["transactions", eventId],
    queryFn: () => fetchTransactions(eventId),
    // Sync pagination meta when first page arrives
    select: (page) => {
      // side-effect-free: pagination meta is read from `data` below
      return page;
    },
  });

  // Derive pagination state from firstPage result when extraPages is empty
  const effectiveCursor = extraPages.length > 0 ? nextCursor : (firstPage?.cursor ?? null);
  const effectiveHasMore = extraPages.length > 0 ? hasMore : (firstPage?.hasMore ?? false);
  const allTransactions = [
    ...(firstPage?.rows ?? []),
    ...extraPages.flat(),
  ];

  // Load more — triggered by click, never by an effect
  const loadMore = useCallback(async () => {
    const cursor = effectiveCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchTransactions(eventId, cursor);
      setExtraPages((prev) => [...prev, page.rows]);
      setNextCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setMoreError(err instanceof Error ? err.message : "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [effectiveCursor, eventId, loadingMore]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading transactions">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-[var(--bg-muted)] animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[color-mix(in_srgb,var(--error)_25%,transparent)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
      >
        {error instanceof Error ? error.message : "Failed to load transactions."}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (allTransactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">No transactions yet.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Transactions will appear here once escrow activity begins.
        </p>
      </div>
    );
  }

  // ── Transaction list ───────────────────────────────────────────────────────
  return (
    <div className="space-y-1">
      {allTransactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors"
        >
          {/* Type + status + hash */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-[var(--text)]">
                {TYPE_LABELS[tx.type] ?? tx.type}
              </span>
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  STATUS_STYLES[tx.status] ?? STATUS_STYLES.pending
                }`}
              >
                {tx.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <code className="font-mono">
                {tx.tx_hash.slice(0, 6)}…{tx.tx_hash.slice(-6)}
              </code>
              <span aria-hidden="true">·</span>
              <span>{timeAgo(tx.created_at)}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium text-[var(--text)]">{formatAmount(tx.amount)}</p>
          </div>

          {/* Explorer link */}
          <a
            href={buildExplorerUrl(tx.tx_hash, tx.network_mode, explorerBase)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            aria-label={`View transaction ${tx.tx_hash.slice(0, 8)} on Stellar Explorer (opens in new tab)`}
            title="View on Stellar Expert"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M10 2h4v4M9 7l5-5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      ))}

      {moreError && (
        <p role="alert" className="text-xs text-[var(--error)] px-1 pt-1">
          {moreError}
        </p>
      )}

      {effectiveHasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full mt-2 rounded-lg border border-[var(--border)] py-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
