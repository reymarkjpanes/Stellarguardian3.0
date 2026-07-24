"use client";

/**
 * Winners tab — role-aware.
 *
 * Participant: sees all winners, highlighted if they are one,
 *   with their disbursement status clearly communicated.
 *
 * Organizer: same list + form to assign a winner from submitted projects.
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Winner {
  id: string;
  recipient_id: string;
  team_id: string | null;
  prize_amount: number;
  disbursement_status: string;
  recipient_name: string;
  team_name: string | null;
}

interface SubmissionOption {
  id: string;
  submitter_id: string;
  team_id: string | null;
  submitter_name: string;
  team_name: string | null;
}

interface Props {
  eventId: string;
  eventState: string;
  winners: Winner[];
  submissions: SubmissionOption[];
  isOrganizer: boolean;
  userId?: string | null;
}

// ─── Disbursement badge ───────────────────────────────────────────────────────

function DisbursementBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const [cls, label] =
    s === "disbursed"
      ? ["bg-[var(--success-bg)] text-[var(--success)]", "Paid ✓"]
      : s === "held"
        ? ["bg-[var(--warning-bg)] text-[var(--warning)]", "Held — connect wallet"]
        : s === "pending"
          ? ["bg-[var(--badge-bg)] text-[var(--badge-text)]", "Pending"]
          : ["bg-[var(--badge-bg)] text-[var(--badge-text)]", status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WinnersClient({
  eventId,
  eventState,
  winners: initialWinners,
  submissions,
  isOrganizer,
  userId,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Organizer: assign winner form
  const [showAssign, setShowAssign] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState("");
  const [prizeAmount, setPrizeAmount] = useState("");
  const [assigning, setAssigning] = useState(false);

  const canAssign =
    isOrganizer && (eventState === "WinnerVerification" || eventState === "PrizeApproved");

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!selectedSubId || !prizeAmount) return;
    setAssigning(true);
    setError(null);

    const selected = submissions.find((s) => s.id === selectedSubId);
    const res = await fetch(`/api/events/${eventId}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_id: selected?.submitter_id,
        team_id: selected?.team_id ?? null,
        prize_amount: Number(prizeAmount),
      }),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to assign winner.");
    } else {
      setSelectedSubId("");
      setPrizeAmount("");
      setShowAssign(false);
      router.refresh();
    }
    setAssigning(false);
  }

  // Check if current user is a winner
  const myWin = userId ? initialWinners.find((w) => w.recipient_id === userId) : null;

  const revealed =
    eventState === "WinnerVerification" ||
    eventState === "PrizeApproved" ||
    eventState === "EscrowRelease" ||
    eventState === "Completed" ||
    eventState === "Archived";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Winners</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {revealed
              ? `${initialWinners.length} winner${initialWinners.length !== 1 ? "s" : ""} selected.`
              : "Winners will be announced after judging completes."}
          </p>
        </div>
        {canAssign && !showAssign && submissions.length > 0 && (
          <button
            onClick={() => setShowAssign(true)}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Assign Winner
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 flex items-center justify-between gap-3"
        >
          <p className="text-sm text-[var(--error)]">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-[var(--error)] hover:underline shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* You won! banner */}
      {myWin && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-muted)] p-5 space-y-2">
          <p className="text-sm font-semibold text-[var(--accent)]">
            🎉 Congratulations &mdash; you&apos;re a winner!
          </p>
          <p className="text-sm text-[var(--text)]">
            Prize: <strong>{myWin.prize_amount} XLM</strong>
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Disbursement status:</span>
            <DisbursementBadge status={myWin.disbursement_status} />
          </div>
          {myWin.disbursement_status === "held" && (
            <p className="text-xs text-[var(--warning)]">
              Your prize is held because no verified wallet is on file. Go to{" "}
              <a href="/settings" className="underline hover:text-[var(--text)]">
                Settings
              </a>{" "}
              to connect and verify your wallet.
            </p>
          )}
        </div>
      )}

      {/* Organizer: assign winner form */}
      {showAssign && (
        <form onSubmit={handleAssign} className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Assign Winner</h3>
          <div className="space-y-1.5">
            <label
              htmlFor="winner-sub"
              className="text-xs font-medium text-[var(--text-secondary)]"
            >
              Submission
            </label>
            <select
              id="winner-sub"
              value={selectedSubId}
              onChange={(e) => setSelectedSubId(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="">Select a submission…</option>
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.team_name ?? s.submitter_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="prize-amount"
              className="text-xs font-medium text-[var(--text-secondary)]"
            >
              Prize Amount (XLM)
            </label>
            <input
              id="prize-amount"
              type="number"
              step="0.0000001"
              min="0.0000001"
              value={prizeAmount}
              onChange={(e) => setPrizeAmount(e.target.value)}
              required
              placeholder="e.g. 500"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={assigning}
              className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {assigning ? "Assigning…" : "Assign"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAssign(false);
                setSelectedSubId("");
                setPrizeAmount("");
              }}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Winners list */}
      {!revealed ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Winners will be revealed once the organizer completes winner verification.
          </p>
        </div>
      ) : initialWinners.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">No winners assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialWinners.map((w, idx) => (
            <div
              key={w.id}
              className={`card p-4 flex items-center gap-4 ${
                w.recipient_id === userId ? "border-[var(--accent)]" : ""
              }`}
            >
              <span className="text-2xl font-bold text-[var(--text-muted)] w-8 shrink-0 text-center">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)] truncate">
                  {w.team_name ?? w.recipient_name}
                  {w.recipient_id === userId && (
                    <span className="ml-2 text-[var(--accent)] text-xs">(you)</span>
                  )}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {w.prize_amount.toLocaleString()} XLM
                </p>
              </div>
              <DisbursementBadge status={w.disbursement_status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
