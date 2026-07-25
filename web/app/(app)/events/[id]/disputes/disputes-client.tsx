"use client";

/**
 * Disputes tab — role-aware rendering.
 *
 * Participant (DisputeWindow state):
 *   - File a new dispute (title + description)
 *   - See all disputes and their state
 *
 * Organizer:
 *   - See all disputes, resolve them (uphold / dismiss)
 *
 * Everyone else:
 *   - Read-only list during appropriate phases
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dispute {
  id: string;
  filed_by: string;
  state: string;
  title?: string;
  description: string;
  created_at: string;
  filer_name: string;
}

interface Props {
  eventId: string;
  eventState: string;
  disputes: Dispute[];
  userRole: string | null;
  userId?: string | null;
}

// ─── State badge ─────────────────────────────────────────────────────────────

function DisputeStateBadge({ state }: { state: string }) {
  const s = state.toLowerCase();
  const cls =
    s === "open" || s === "underreview"
      ? "bg-[var(--warning-bg)] text-[var(--warning)]"
      : s === "upheld"
        ? "bg-[var(--error-bg)] text-[var(--error)]"
        : s === "dismissed" || s === "withdrawn"
          ? "bg-[var(--badge-bg)] text-[var(--badge-text)]"
          : "bg-[var(--badge-bg)] text-[var(--badge-text)]";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{state}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DisputesClient({
  eventId,
  eventState,
  disputes: initialDisputes,
  userRole,
}: Props) {
  const router = useRouter();
  const isParticipant = userRole === "Participant";
  const isOrganizer = userRole === "Organizer";
  const canFile = isParticipant && eventState === "DisputeWindow";

  const [disputes, setDisputes] = useState<Dispute[]>(initialDisputes);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Organizer: resolve dispute
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolveOpenId, setResolveOpenId] = useState<string | null>(null);

  async function handleFile(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/disputes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to file dispute.");
    } else {
      setSuccess("Dispute filed. The organizer will review it.");
      setTitle("");
      setDescription("");
      setShowForm(false);
      router.refresh();
    }
    setSubmitting(false);
  }

  async function handleResolve(disputeId: string, action: "Upheld" | "Dismissed") {
    setResolving(disputeId);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_state: action, resolution }),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to resolve dispute.");
    } else {
      setDisputes((prev) => prev.map((d) => (d.id === disputeId ? { ...d, state: action } : d)));
      setResolveOpenId(null);
      setResolution("");
    }
    setResolving(null);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Disputes</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {eventState === "DisputeWindow"
              ? "The review window is open. Participants can file disputes about judging decisions."
              : "Disputes can only be filed during the Review (Dispute) Window."}
          </p>
        </div>
        {canFile && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            File Dispute
          </button>
        )}
      </div>

      {/* Feedback banners */}
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
      {success && (
        <div
          role="status"
          className="rounded-md border border-[var(--success)] bg-[var(--success-bg)] px-4 py-3"
        >
          <p className="text-sm text-[var(--success)]">{success}</p>
        </div>
      )}

      {/* File dispute form */}
      {showForm && (
        <form onSubmit={handleFile} className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">File a Dispute</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Use this form if you believe a judging decision was incorrect or unfair. Disputes are
            reviewed by the organizer and logged permanently.
          </p>
          <div className="space-y-1.5">
            <label
              htmlFor="dispute-title"
              className="text-xs font-medium text-[var(--text-secondary)]"
            >
              Subject
            </label>
            <input
              id="dispute-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Brief summary of your dispute"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="dispute-desc"
              className="text-xs font-medium text-[var(--text-secondary)]"
            >
              Description
            </label>
            <textarea
              id="dispute-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={20}
              maxLength={2000}
              rows={4}
              placeholder="Explain the issue in detail. Include any relevant evidence or context."
              className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {submitting ? "Filing…" : "Submit Dispute"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setTitle("");
                setDescription("");
              }}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Disputes list */}
      {disputes.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {eventState === "DisputeWindow"
              ? "No disputes filed yet."
              : "No disputes were filed during this event."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {d.title && (
                    <p className="text-sm font-medium text-[var(--text)] truncate">{d.title}</p>
                  )}
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Filed by {d.filer_name} · {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
                <DisputeStateBadge state={d.state} />
              </div>

              <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{d.description}</p>

              {/* Organizer resolution */}
              {isOrganizer && (d.state === "Open" || d.state === "UnderReview") && (
                <>
                  {resolveOpenId === d.id ? (
                    <div className="border-t border-[var(--border)] pt-3 space-y-2">
                      <textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Resolution notes (optional)"
                        maxLength={500}
                        rows={2}
                        className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={resolving === d.id}
                          onClick={() => handleResolve(d.id, "Upheld")}
                          className="rounded-md border border-[var(--error)] px-3 py-1 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] disabled:opacity-50 transition-colors"
                        >
                          Uphold
                        </button>
                        <button
                          disabled={resolving === d.id}
                          onClick={() => handleResolve(d.id, "Dismissed")}
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => setResolveOpenId(null)}
                          className="text-xs text-[var(--text-muted)] hover:underline ml-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolveOpenId(d.id)}
                      className="text-xs font-medium text-[var(--accent)] hover:underline"
                    >
                      Resolve →
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
