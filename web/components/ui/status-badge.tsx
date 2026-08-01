import React from "react";

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "submitted"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : s === "draft"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : "bg-[var(--badge-bg)] text-[var(--badge-text)]";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
