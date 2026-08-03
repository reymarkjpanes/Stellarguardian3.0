"use client";

/**
 * Judge Evaluations Client — shows assigned submissions with:
 * - Actual DB status (H7 / C4 — no longer hardcoded "Draft")
 * - Scoring rubric criteria inline so judges know what they're scoring against (H7)
 * - "Declare Conflict of Interest" button per row (H8)
 * - Progress bar showing scored vs total
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { declareConflictAction } from "@/app/actions/judging.actions";
import type { EvaluationCriterion } from "@/app/actions/judging-rubric.actions";

interface EvalRow {
  evaluationId: string;
  submissionId: string;
  status: string;
  score: number | null;
  conflictOfInterest: boolean;
  version: number;
  updatedAt: string;
  teamName: string | null;
  submitterName: string | null;
}

interface Props {
  eventId: string;
  eventState: string;
  assignments: EvalRow[];
  criteria: EvaluationCriterion[];
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "submitted" || s === "finalized"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : s === "draft"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : "bg-[var(--badge-bg)] text-[var(--badge-text)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
}

export function JudgeEvaluationsClient({ eventId, eventState, assignments, criteria }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<EvalRow[]>(assignments);
  const [coiError, setCoiError] = useState<string | null>(null);
  const [declaringId, setDeclaringId] = useState<string | null>(null);
  const [confirmCOIId, setConfirmCOIId] = useState<string | null>(null);
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const judging = eventState === "JudgingRound1" || eventState === "JudgingRound2";

  const totalAssignments = rows.length;
  const scoredCount = rows.filter(
    (ev) => ev.status === "Submitted" || ev.status === "Finalized" || ev.conflictOfInterest,
  ).length;
  const allDone = totalAssignments > 0 && scoredCount === totalAssignments;
  const progressPercentage = totalAssignments > 0 ? (scoredCount / totalAssignments) * 100 : 0;

  function handleDeclareCOI(ev: EvalRow) {
    setConfirmCOIId(ev.evaluationId);
  }

  function executeCOI(ev: EvalRow) {
    setConfirmCOIId(null);
    setDeclaringId(ev.evaluationId);
    setCoiError(null);

    startTransition(async () => {
      const result = await declareConflictAction(
        ev.evaluationId,
        undefined,
        ev.version,
        eventId,
        ev.submissionId,
      );

      if (result?.success) {
        setRows((prev) =>
          prev.map((r) =>
            r.evaluationId === ev.evaluationId
              ? { ...r, conflictOfInterest: true, status: "Submitted" }
              : r,
          ),
        );
        router.refresh();
      } else {
        setCoiError(result?.error ?? "Failed to declare conflict.");
      }
      setDeclaringId(null);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">My Evaluations</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {judging
            ? "Score each assigned submission below. Submit your final score when ready."
            : `Judging is not currently active (${eventState}).`}
        </p>
      </div>

      {/* Rubric criteria — collapsible so judges know what they're scoring against (H7) */}
      {criteria.length > 0 && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setCriteriaOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <span>Scoring Rubric ({criteria.length} criteria)</span>
            <span className="text-[var(--text-muted)] text-xs">
              {criteriaOpen ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {criteriaOpen && (
            <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {criteria.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)]">{c.name}</p>
                    {c.description && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs font-medium text-[var(--text)]">Max: {c.max_score}</p>
                    <p className="text-xs text-[var(--text-muted)]">Weight: {c.weight}×</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {rows.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-[var(--text)]">Judging Progress</h3>
            <span className="text-sm font-semibold text-[var(--text)]">
              {scoredCount} / {totalAssignments} Scored
            </span>
          </div>
          <div className="w-full bg-[var(--bg-muted)] rounded-full h-2">
            <div
              className="bg-[var(--accent)] h-2 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {allDone && (
            <p className="text-xs text-[var(--success)] mt-2 font-medium">
              ✓ All submissions scored — great work!
            </p>
          )}
        </div>
      )}

      {/* COI error */}
      {coiError && (
        <div
          role="alert"
          className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 flex items-center justify-between"
        >
          <p className="text-sm text-[var(--error)]">{coiError}</p>
          <button
            onClick={() => setCoiError(null)}
            className="text-xs text-[var(--error)] hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 ? (
        <EmptyState
          title="No assignments yet."
          description="No submissions have been assigned to you yet."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((ev) => (
            <div
              key={ev.evaluationId}
              className={`card p-4 flex items-center justify-between gap-4 ${
                ev.conflictOfInterest ? "opacity-60" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text)] truncate">
                  {ev.teamName ?? ev.submitterName ?? "Unknown"}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {ev.score != null ? `Score: ${ev.score}` : "Not scored"}
                  {ev.conflictOfInterest && (
                    <span className="ml-2 text-[var(--warning)]">⚠ Conflict declared</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={ev.conflictOfInterest ? "Conflict" : ev.status} />

                {/* COI button — only when judging is active and not yet declared (H8) */}
                {judging && !ev.conflictOfInterest && confirmCOIId !== ev.evaluationId && (
                  <button
                    onClick={() => handleDeclareCOI(ev)}
                    disabled={isPending && declaringId === ev.evaluationId}
                    title="Declare conflict of interest"
                    className="rounded-md border border-[var(--warning)] px-2.5 py-1 text-[10px] font-medium text-[var(--warning)] hover:bg-[var(--warning-bg)] transition-colors disabled:opacity-50"
                  >
                    {isPending && declaringId === ev.evaluationId ? "…" : "COI"}
                  </button>
                )}

                {/* Inline COI confirm */}
                {judging && !ev.conflictOfInterest && confirmCOIId === ev.evaluationId && (
                  <div
                    role="alertdialog"
                    aria-label="Confirm conflict of interest"
                    className="flex items-center gap-1.5 rounded-md border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-2 py-1"
                  >
                    <span className="text-[10px] text-[var(--warning)]">COI?</span>
                    <button
                      onClick={() => executeCOI(ev)}
                      className="text-[10px] font-medium text-[var(--warning)] hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmCOIId(null)}
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      No
                    </button>
                  </div>
                )}

                {/* Score / View — disabled when COI declared */}
                {!ev.conflictOfInterest && (
                  <a
                    href={`/events/${eventId}/judge/workspace/${ev.submissionId}`}
                    className="rounded-md border border-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors"
                  >
                    {ev.status === "Submitted" || ev.status === "Finalized" ? "View" : "Score"}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
