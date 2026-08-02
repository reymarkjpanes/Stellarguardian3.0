/**
 * Event edit page — modify event details (organizer only).
 *
 * Implements optimistic concurrency (Req 19.2): the current `version` is loaded
 * on mount and sent with every PATCH so the server can detect concurrent edits
 * and return 409 Conflict instead of silently overwriting changes.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

const CATEGORY_OPTIONS = ["hackathon", "challenge", "bounty", "competition", "grant"];
const FORMAT_OPTIONS = ["online", "in-person", "hybrid"];

export default function EventEditPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);

  // Optimistic concurrency token — must be sent with every PATCH (Req 19.2)
  const [version, setVersion] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("hackathon");
  const [format, setFormat] = useState("online");
  const [teamSizeMin, setTeamSizeMin] = useState(1);
  const [teamSizeMax, setTeamSizeMax] = useState(5);
  const [prizePool, setPrizePool] = useState("");
  // Store as YYYY-MM-DD for <input type="date"> — converted to ISO on submit
  const [deadline, setDeadline] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");

  useEffect(() => {
    async function loadEvent() {
      const supabase = createBrowserClient();
      const { data: event } = await supabase
        .from("events")
        .select(
          "title, description, category, format, team_size_min, team_size_max, prize_pool_target, registration_deadline, submission_deadline, version, state, organizer_id",
        )
        .eq("id", eventId)
        .single();

      if (!event) {
        router.push("/dashboard");
        return;
      }

      // Only editable in Draft or Published — redirect once registration opens
      const editableStates = ["Draft", "Published"];
      if (!editableStates.includes(event.state)) {
        router.push(`/events/${eventId}`);
        return;
      }

      // Verify organizer (belt-and-suspenders — layout also checks)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.id !== event.organizer_id) {
        router.push(`/events/${eventId}`);
        return;
      }

      setVersion(event.version);
      setTitle(event.title);
      setDescription(event.description);
      setCategory(event.category);
      setFormat(event.format);
      setTeamSizeMin(event.team_size_min);
      setTeamSizeMax(event.team_size_max);
      setPrizePool(event.prize_pool_target?.toString() ?? "");
      // Normalise to YYYY-MM-DD for <input type="date">
      setDeadline(event.registration_deadline?.slice(0, 10) ?? "");
      setSubmissionDeadline(
        (event as Record<string, unknown>).submission_deadline
          ? String((event as Record<string, unknown>).submission_deadline).slice(0, 10)
          : "",
      );
      setLoading(false);
    }

    loadEvent();
  }, [eventId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (version === null) return; // guard: version not yet loaded
    setSaving(true);
    setError(null);
    setConflictError(false);

    if (title.trim().length < 5) {
      setError("Title must be at least 5 characters.");
      setSaving(false);
      return;
    }
    if (description.trim().length < 20) {
      setError("Description must be at least 20 characters.");
      setSaving(false);
      return;
    }

    // Validate team sizes inline before hitting the server
    if (teamSizeMin < 1 || teamSizeMax < teamSizeMin) {
      setError("Max team size must be ≥ min team size.");
      setSaving(false);
      return;
    }
    if (teamSizeMax > 20) {
      setError("Maximum team size cannot exceed 20.");
      setSaving(false);
      return;
    }
    if (prizePool && Number(prizePool) < 0) {
      setError("Prize pool cannot be negative.");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Concurrency token — required by server (Req 19.2)
        version,
        title: title.trim(),
        description: description.trim(),
        category,
        format,
        team_size_min: teamSizeMin,
        team_size_max: teamSizeMax,
        prize_pool_target: prizePool ? Number(prizePool) : null,
        // Convert date-only string to full ISO datetime (midnight UTC)
        registration_deadline: deadline
          ? new Date(deadline + "T00:00:00.000Z").toISOString()
          : null,
        submission_deadline: submissionDeadline
          ? new Date(submissionDeadline + "T00:00:00.000Z").toISOString()
          : null,
      }),
    });

    if (res.status === 409) {
      // Concurrent edit detected — ask user to reload
      setConflictError(true);
      setSaving(false);
      return;
    }

    if (!res.ok) {
      const body = await res.json();
      setError(body?.error?.message ?? "Failed to save.");
      setSaving(false);
      return;
    }

    const { data: updated } = await res.json();
    // Update version to the new value so a second save in the same session works
    if (updated?.version !== undefined) {
      setVersion(updated.version);
    }

    router.push(`/events/${eventId}`);
  }

  const inputCls =
    "w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]";
  const labelCls = "block text-sm font-medium text-[var(--text-secondary)] mb-1";

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-[var(--bg-muted)] rounded" />
          <div className="h-64 bg-[var(--bg-muted)] rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Edit Event</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Changes take effect immediately. State transitions still require the lifecycle controls on
          the overview page.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset className="card p-6 space-y-5" disabled={saving}>
          {/* Title */}
          <div>
            <label htmlFor="evt-title" className={labelCls}>
              Title <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="evt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="evt-desc" className={labelCls}>
              Description <span className="text-[var(--error)]">*</span>
            </label>
            <textarea
              id="evt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              maxLength={10000}
              className={inputCls}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">{description.length} / 10000</p>
          </div>

          {/* Category + Format */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evt-cat" className={labelCls}>
                Category
              </label>
              <select
                id="evt-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputCls}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="evt-fmt" className={labelCls}>
                Format
              </label>
              <select
                id="evt-fmt"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className={inputCls}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Team sizes + Prize pool */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="evt-min" className={labelCls}>
                Min Team Size
              </label>
              <input
                id="evt-min"
                type="number"
                min={1}
                max={20}
                value={teamSizeMin}
                onChange={(e) => setTeamSizeMin(+e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="evt-max" className={labelCls}>
                Max Team Size
              </label>
              <input
                id="evt-max"
                type="number"
                min={1}
                max={20}
                value={teamSizeMax}
                onChange={(e) => setTeamSizeMax(+e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="evt-prize" className={labelCls}>
                Prize Pool (XLM)
              </label>
              <input
                id="evt-prize"
                type="number"
                min={0}
                step="any"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                placeholder="e.g. 10000"
                className={inputCls}
              />
            </div>
          </div>

          {/* Registration Deadline */}
          <div>
            <label htmlFor="evt-deadline" className={labelCls}>
              Registration Deadline{" "}
              <span className="font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              id="evt-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputCls}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Required before publishing. Treated as midnight UTC on the selected date.
            </p>
          </div>

          {/* Submission Deadline (H4) */}
          <div>
            <label htmlFor="evt-sub-deadline" className={labelCls}>
              Submission Deadline{" "}
              <span className="font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              id="evt-sub-deadline"
              type="date"
              value={submissionDeadline}
              onChange={(e) => setSubmissionDeadline(e.target.value)}
              className={inputCls}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Deadline for participants to submit their projects. Shown on the submissions page.
            </p>
          </div>
        </fieldset>

        {/* Conflict error */}
        {conflictError && (
          <div
            className="rounded-md border border-[var(--warning,#f59e0b)]/40 bg-[var(--warning,#f59e0b)]/8 px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-medium text-[var(--warning,#f59e0b)]">
              This event was modified by someone else while you were editing.
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Reload the page to get the latest version, then apply your changes again.
            </p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-2 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Reload page →
            </button>
          </div>
        )}

        {/* Validation / server error */}
        {error && (
          <div
            className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3"
            role="alert"
          >
            <p className="text-sm text-[var(--error)]">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || version === null}
            className="btn-primary px-5 py-2 text-sm font-medium rounded-md disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <a
            href={`/events/${eventId}`}
            className="rounded-md border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </main>
  );
}
