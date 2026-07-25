"use client";

/**
 * TransactionStatus — displays the lifecycle of a blockchain transaction.
 *
 * Design read: functional, information-dense, matches existing dark/light
 * token system. No generic "loading spinner" — each state has a distinct
 * visual treatment and progress indicator.
 *
 * Shows:
 * - Current status with animated indicator
 * - Transaction hash (truncated) with copy + explorer link
 * - Error message + recovery action
 * - Retry button for retryable failures
 */
import type { TransactionState } from "@/lib/blockchain/transaction-manager";
import { TRANSACTION_STATUS_LABELS } from "@/lib/blockchain/transaction-manager";

interface TransactionStatusProps {
  state: TransactionState;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const ACTIVE_STATUSES = new Set([
  "preparing",
  "simulating",
  "awaiting_signature",
  "submitting",
  "pending_confirmation",
]);

export function TransactionStatus({
  state,
  onRetry,
  onDismiss,
  className = "",
}: TransactionStatusProps) {
  if (state.status === "idle") return null;

  const isActive = ACTIVE_STATUSES.has(state.status);
  const isConfirmed = state.status === "confirmed";
  const isFailed = state.status === "failed";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        "rounded-lg border px-4 py-3 text-sm transition-all",
        isConfirmed
          ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[var(--success-bg)]"
          : isFailed
            ? "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[var(--error-bg)]"
            : "border-[var(--border)] bg-[var(--bg-muted)]",
        className,
      ].join(" ")}
    >
      {/* Status row */}
      <div className="flex items-center gap-2.5">
        {isActive && (
          <span
            aria-hidden="true"
            className="shrink-0 h-4 w-4 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin"
          />
        )}
        {isConfirmed && (
          <span
            aria-hidden="true"
            className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white text-[10px] font-bold"
          >
            ✓
          </span>
        )}
        {isFailed && (
          <span
            aria-hidden="true"
            className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--error)] text-white text-[10px] font-bold"
          >
            ✕
          </span>
        )}

        <span
          className={[
            "font-medium",
            isConfirmed
              ? "text-[var(--success)]"
              : isFailed
                ? "text-[var(--error)]"
                : "text-[var(--text)]",
          ].join(" ")}
        >
          {TRANSACTION_STATUS_LABELS[state.status]}
        </span>
      </div>

      {/* Transaction hash */}
      {state.txHash && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Tx:</span>
          <code className="text-xs text-[var(--text)] font-mono">
            {state.txHash.slice(0, 8)}…{state.txHash.slice(-6)}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(state.txHash!)}
            title="Copy transaction hash"
            className="text-xs text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            aria-label="Copy transaction hash"
          >
            Copy
          </button>
          {state.explorerUrl && (
            <a
              href={state.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
              aria-label="View transaction on Stellar Explorer (opens in new tab)"
            >
              View ↗
            </a>
          )}
        </div>
      )}

      {/* Error message + recovery */}
      {isFailed && state.errorMessage && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-[var(--error)]">{state.errorMessage}</p>
          {state.recoveryAction && (
            <p className="text-xs text-[var(--text-muted)]">{state.recoveryAction}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {state.retryable && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors focus:outline-none"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
