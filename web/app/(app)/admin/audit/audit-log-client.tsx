"use client";

/**
 * Audit log client — filter controls, record list, and CSV export (H8).
 *
 * Filters submit as URL search params so the server re-queries with the
 * correct predicates (no client-side filtering of a stale dataset).
 * CSV export runs entirely client-side from the already-fetched records.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export interface AuditRecord {
  id: string;
  action: string;
  actorDisplay: string;
  resourceType: string;
  resourceId: string;
  eventId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Filters {
  action: string;
  from: string;
  to: string;
  resource: string;
}

interface Props {
  records: AuditRecord[];
  filters: Filters;
  totalCount: number;
}

function escapeCsv(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
  // Wrap in quotes if contains comma, newline, or quote; escape internal quotes
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function AuditLogClient({ records, filters, totalCount }: Props) {
  const router = useRouter();
  const [action, setAction] = useState(filters.action);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [resource, setResource] = useState(filters.resource);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (resource.trim()) params.set("resource", resource.trim());
    router.push(`/admin/audit?${params.toString()}`);
  }

  function clearFilters() {
    setAction("");
    setFrom("");
    setTo("");
    setResource("");
    router.push("/admin/audit");
  }

  function exportCsv() {
    const headers = [
      "Timestamp",
      "Action",
      "Actor",
      "Resource Type",
      "Resource ID",
      "Event ID",
      "Metadata",
    ];
    const rows = records.map((r) => [
      r.createdAt,
      r.action,
      r.actorDisplay,
      r.resourceType,
      r.resourceId,
      r.eventId ?? "",
      JSON.stringify(r.metadata),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasFilters = !!(action || from || to || resource);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Immutable record of all platform actions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            ← Back to Admin
          </Link>
          <button
            onClick={exportCsv}
            disabled={records.length === 0}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter form */}
      <form onSubmit={applyFilters} className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label
            htmlFor="audit-action"
            className="text-xs font-medium text-[var(--text-secondary)]"
          >
            Action
          </label>
          <input
            id="audit-action"
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. escrow.fund"
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[140px]">
          <label
            htmlFor="audit-resource"
            className="text-xs font-medium text-[var(--text-secondary)]"
          >
            Resource Type
          </label>
          <input
            id="audit-resource"
            type="text"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            placeholder="e.g. events"
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="audit-from" className="text-xs font-medium text-[var(--text-secondary)]">
            From
          </label>
          <input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="audit-to" className="text-xs font-medium text-[var(--text-secondary)]">
            To
          </label>
          <input
            id="audit-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Filter
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-[var(--border)] px-4 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-[var(--text-muted)] ml-auto self-end">
          {totalCount} record{totalCount !== 1 ? "s" : ""}
          {totalCount === 500 && " (limit 500 — refine filters to narrow)"}
        </p>
      </form>

      {/* Record list */}
      {records.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No audit records match the current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {records.map((record) => {
            const hasMetadata = record.metadata && Object.keys(record.metadata).length > 0;
            const isExpanded = expanded.has(record.id);

            return (
              <div key={record.id} className="card overflow-hidden">
                <div
                  className={`p-4 ${hasMetadata ? "cursor-pointer hover:bg-[var(--bg-muted)] transition-colors" : ""}`}
                  onClick={() => hasMetadata && toggleExpanded(record.id)}
                  role={hasMetadata ? "button" : undefined}
                  tabIndex={hasMetadata ? 0 : undefined}
                  onKeyDown={(e) =>
                    hasMetadata && (e.key === "Enter" || e.key === " ") && toggleExpanded(record.id)
                  }
                  aria-expanded={hasMetadata ? isExpanded : undefined}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-[var(--text)] font-mono truncate">
                        {record.action}
                      </span>
                      {record.eventId && (
                        <Link
                          href={`/events/${record.eventId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-[var(--accent)] hover:underline shrink-0"
                        >
                          event ↗
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                      {hasMetadata && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span>
                      <span className="text-[var(--text-secondary)]">Actor:</span>{" "}
                      {record.actorDisplay}
                    </span>
                    <span>
                      <span className="text-[var(--text-secondary)]">Resource:</span>{" "}
                      {record.resourceType}
                      {record.resourceId && (
                        <span className="opacity-60">/{record.resourceId.slice(0, 8)}…</span>
                      )}
                    </span>
                  </div>
                </div>

                {hasMetadata && isExpanded && (
                  <div className="border-t border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3">
                    <pre className="text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(record.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
