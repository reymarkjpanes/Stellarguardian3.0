/**
 * Event Milestones Page — C4 (Phase 3)
 *
 * Visible to: Organizers (can create + update) and Sponsors (read-only).
 * All other roles are redirected to the event overview.
 *
 * Data: GET /api/events/[id]/milestones
 * Create: POST /api/events/[id]/milestones (organizer only)
 * Update status: PATCH /api/events/[id]/milestones (organizer only)
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
}

const STATUS_META: Record<Milestone["status"], { label: string; color: string; icon: string }> = {
  pending: { label: "Pending", color: "bg-[var(--bg-muted)] text-[var(--text-muted)]", icon: "○" },
  in_progress: {
    label: "In Progress",
    color: "bg-[var(--warning-bg)] text-[var(--warning)]",
    icon: "◑",
  },
  completed: {
    label: "Completed",
    color: "bg-[var(--success-bg,#dcfce7)] text-[var(--success,#16a34a)]",
    icon: "✓",
  },
};

export default function MilestonesPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Status update optimistic state
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Check role
      const { data: membership } = await supabase
        .from("event_members")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      const role = membership?.role ?? null;
      // Only Organizer and Sponsor can view milestones
      if (role !== "Organizer" && role !== "Sponsor") {
        router.push(`/events/${eventId}`);
        return;
      }

      const res = await fetch(`/api/events/${eventId}/milestones`);
      const { data } = await res.json();

      if (!ignore) {
        setMilestones(data ?? []);
        setIsOrganizer(role === "Organizer");
        setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [eventId, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError(null);

    const res = await fetch(`/api/events/${eventId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        due_date: newDue ? new Date(newDue + "T00:00:00.000Z").toISOString() : undefined,
        status: "pending",
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setCreateError(json.error?.message ?? "Failed to create milestone.");
    } else {
      setMilestones((prev) => [...prev, json.data]);
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewDue("");
    }
    setCreating(false);
  }

  async function handleStatusChange(milestoneId: string, newStatus: Milestone["status"]) {
    setUpdating(milestoneId);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/milestones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: milestoneId, status: newStatus }),
    });

    if (res.ok) {
      const { data } = await res.json();
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, status: data.status } : m)),
      );
    } else {
      setError("Failed to update milestone status.");
    }
    setUpdating(null);
  }

  const inputCls =
    "w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const progressPct =
    milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-[var(--bg-muted)] rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-4 h-20 bg-[var(--bg-muted)]" />
        ))}
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Milestones</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Track key deliverables and progress checkpoints.
          </p>
        </div>
        {isOrganizer && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Add Milestone
          </button>
        )}
      </div>

      {/* Global error */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 flex justify-between items-center"
        >
          <p className="text-sm text-[var(--error)]">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-[var(--error)] hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* Progress bar */}
      {milestones.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--text)]">Overall Progress</span>
            <span className="font-semibold text-[var(--text)]">
              {completedCount} / {milestones.length} completed
            </span>
          </div>
          <div className="h-2 w-full bg-[var(--bg-muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">{progressPct}% complete</p>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">New Milestone</h2>

          {createError && (
            <div
              role="alert"
              className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]"
            >
              {createError}
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="ms-title"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Title <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="ms-title"
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Submit judging criteria"
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="ms-desc"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Description <span className="font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              id="ms-desc"
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What needs to happen by this milestone?"
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="ms-due"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Due Date <span className="font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              id="ms-due"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {creating ? "Adding…" : "Add Milestone"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setCreateError(null);
              }}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Milestones list */}
      {milestones.length === 0 && !showCreate ? (
        <div className="card p-12 text-center space-y-3">
          <p className="text-sm font-medium text-[var(--text)]">No milestones yet</p>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {isOrganizer
              ? "Add milestones to track key deliverables and show sponsors your event's progress."
              : "The organizer hasn't added any milestones yet."}
          </p>
          {isOrganizer && (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Add First Milestone
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => {
            const meta = STATUS_META[m.status];
            const isPast =
              m.due_date && new Date(m.due_date) < new Date() && m.status !== "completed";
            return (
              <div
                key={m.id}
                className={`card p-4 flex items-start gap-4 ${
                  m.status === "completed" ? "opacity-75" : ""
                }`}
              >
                <span
                  className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${meta.color}`}
                  aria-label={meta.label}
                >
                  {meta.icon}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${m.status === "completed" ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}
                  >
                    {m.title}
                  </p>
                  {m.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{m.description}</p>
                  )}
                  {m.due_date && (
                    <p
                      className={`text-xs mt-1 ${isPast ? "text-[var(--error)]" : "text-[var(--text-muted)]"}`}
                    >
                      Due: {new Date(m.due_date).toLocaleDateString()}
                      {isPast ? " — overdue" : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                    {meta.label}
                  </span>
                  {isOrganizer && m.status !== "completed" && (
                    <div className="flex gap-1">
                      {m.status === "pending" && (
                        <button
                          onClick={() => handleStatusChange(m.id, "in_progress")}
                          disabled={updating === m.id}
                          title="Mark In Progress"
                          className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
                        >
                          {updating === m.id ? "…" : "Start"}
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(m.id, "completed")}
                        disabled={updating === m.id}
                        title="Mark Completed"
                        className="rounded border border-[var(--accent)] px-2 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--accent-muted)] disabled:opacity-50 transition-colors"
                      >
                        {updating === m.id ? "…" : "Complete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
