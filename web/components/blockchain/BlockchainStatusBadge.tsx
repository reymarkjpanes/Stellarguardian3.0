"use client";

/**
 * BlockchainStatusBadge — compact escrow state + sync indicator.
 *
 * Shows the current on-chain state with a color-coded pill and a
 * live sync dot. Used in the event prize/escrow pages.
 *
 * Design read: minimal badge system — state name + sync dot only.
 * No heavy chrome. Matches the existing `status pill` convention in the app.
 */

export type EscrowStateDisplay =
  | "PendingFunding"
  | "PartiallyFunded"
  | "FullyFunded"
  | "Locked"
  | "PendingRelease"
  | "Released"
  | "Cancelled"
  | "Refunded"
  | "Failed"
  | string;

interface BlockchainStatusBadgeProps {
  state: EscrowStateDisplay | null;
  /** Whether the real-time sync is active */
  syncing?: boolean;
  /** Whether there's a state inconsistency detected */
  inconsistent?: boolean;
  /** On-chain balance in XLM */
  balance?: string | null;
  className?: string;
}

const STATE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  PendingFunding: {
    bg: "bg-[var(--bg-muted)]",
    text: "text-[var(--text-muted)]",
    dot: "bg-gray-400",
  },
  PartiallyFunded: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  FullyFunded: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-400",
  },
  Locked: {
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-400",
  },
  PendingRelease: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-400 animate-pulse",
  },
  Released: {
    bg: "bg-[var(--success-bg,oklch(0.97_0.02_145))]",
    text: "text-[var(--success,oklch(0.55_0.15_145))]",
    dot: "bg-[var(--success,oklch(0.55_0.15_145))]",
  },
  Refunded: {
    bg: "bg-[var(--success-bg,oklch(0.97_0.02_145))]",
    text: "text-[var(--success,oklch(0.55_0.15_145))]",
    dot: "bg-[var(--success,oklch(0.55_0.15_145))]",
  },
  Cancelled: {
    bg: "bg-[var(--error-bg,oklch(0.98_0.01_25))]",
    text: "text-[var(--error,oklch(0.55_0.2_25))]",
    dot: "bg-[var(--error,oklch(0.55_0.2_25))]",
  },
  Failed: {
    bg: "bg-[var(--error-bg,oklch(0.98_0.01_25))]",
    text: "text-[var(--error,oklch(0.55_0.2_25))]",
    dot: "bg-[var(--error,oklch(0.55_0.2_25))] animate-pulse",
  },
};

const DEFAULT_STYLE = {
  bg: "bg-[var(--bg-muted)]",
  text: "text-[var(--text-muted)]",
  dot: "bg-gray-400",
};

export function BlockchainStatusBadge({
  state,
  syncing = false,
  inconsistent = false,
  balance,
  className = "",
}: BlockchainStatusBadgeProps) {
  const styles = state ? (STATE_STYLES[state] ?? DEFAULT_STYLE) : DEFAULT_STYLE;

  return (
    <div
      className={`inline-flex flex-col gap-1 ${className}`}
      aria-label={`Escrow status: ${state ?? "unknown"}${inconsistent ? " (inconsistency detected)" : ""}`}
    >
      {/* State pill */}
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.bg} ${styles.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
        <span>{state ?? "Unknown"}</span>
        {/* Sync indicator */}
        {syncing && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-pulse ml-0.5"
            aria-hidden="true"
            title="Syncing with blockchain…"
          />
        )}
      </div>

      {/* Inconsistency warning */}
      {inconsistent && (
        <div className="inline-flex items-center gap-1 text-[10px] text-[var(--warning,oklch(0.6_0.15_85))]">
          <span aria-hidden="true">⚠</span>
          <span>State inconsistency detected</span>
        </div>
      )}

      {/* Balance */}
      {balance && (
        <div className="text-xs text-[var(--text-muted)]">
          <span className="font-mono">{Number(balance).toLocaleString()} XLM</span>
          <span className="ml-1 text-[10px]">on-chain</span>
        </div>
      )}
    </div>
  );
}
