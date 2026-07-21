"use client";

/**
 * Disputes client component — handles file dispute form and resolve dispute interactions only.
 * All data is passed as props from the Server Component parent; no Supabase calls here.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Dispute {
  id: string;
  filed_by: string;
  state: string;
  description: string;
  created_at: string;
  filer_name: string;
}

interface DisputesClientProps {
  eventId: string;
  eventState: string;
  disputes: Dispute[];
  userRole: string | null;
}

export function DisputesClient({
  eventId,
  eventState,
  disputes: initialDisputes,
  userRole,
}: DisputesClientProps) {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>(initialDisputes);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canFile = userRole === "Participant" && eventState === "DisputeWindow";

  async function handleFileDispute(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, reason }),
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Failed to file dispute.");
      setSubmitting(false);
      return;
    }

    setReason("");
    setShowForm(false);
    setSubmitting(false);
    router.refresh();
  }

  async function handleResolveDispute(
    disputeId: string,
    resolution: "Upheld" | "Dismissed",
  ) {
    setResolvingId(disputeId);
    setError(null);

    const res = await fetch(`/api/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: resolution }),
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Failed to resolve dispute.");
    } else {
      // Optimistic update — reflects resolved state immediately
      setDisputes((prev) =>
        prev.map((d) => (d.id === disputeId ? { ...d, state: resolution } : d)),
      );
    }

    setResolvingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Disputes</h2>
        {canFile && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md border border-[var(--error)] px-4 py-1.5 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
          >
            File Dispute
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleFileDispute}
          className="card p-6 space-y-4 border-[var(--error)]"
        >
          <div>
            <label
              htmlFor="dispute-reason"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Reason for Dispute
            </label>
            <textarea
              id="dispute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              placeholder="Describe your objection..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--error)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--error)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Filing..." : "Submit Dispute"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {disputes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No disputes have been filed.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {disputes.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text)]">{d.filer_name}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    d.state === "Open"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : d.state === "Upheld"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : d.state === "Dismissed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                  }`}
                >
                  {d.state}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{d.description}</p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Filed {new Date(d.created_at).toLocaleDateString()}
                </p>
                {/* Resolution buttons for organizers on open disputes */}
                {userRole === "Organizer" &&
                  (d.state === "Open" || d.state === "UnderReview") && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveDispute(d.id, "Upheld")}
                        disabled={resolvingId === d.id}
                        className="rounded-md border border-[var(--error)] px-2.5 py-1 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors disabled:opacity-50"
                      >
                        Uphold
                      </button>
                      <button
                        onClick={() => handleResolveDispute(d.id, "Dismissed")}
                        disabled={resolvingId === d.id}
                        className="rounded-md border border-green-600 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
