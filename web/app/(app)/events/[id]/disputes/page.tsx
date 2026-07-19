/**
 * Event disputes page — file, view, and manage disputes.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Dispute {
  id: string;
  filer_id: string;
  state: string;
  reason: string;
  created_at: string;
  filer_name?: string;
}

export default function EventDisputesPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventState, setEventState] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [eventId]);

  async function loadData() {
    try {
    const supabase = createBrowserClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return;

    const [{ data: event }, { data: membership }] = await Promise.all([
      supabase.from("events").select("state").eq("id", eventId).single(),
      supabase.from("event_members").select("role").eq("event_id", eventId).eq("user_id", user.id).maybeSingle(),
    ]);

    setEventState(event?.state ?? "");
    setUserRole(membership?.role ?? null);

    const { data: disputeData } = await supabase
      .from("disputes")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (disputeData && disputeData.length > 0) {
      const filerIds = [...new Set(disputeData.map((d) => d.filer_id))];
      const { data: users } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", filerIds);
      const usersMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));
      setDisputes(disputeData.map((d) => ({
        ...d,
        filer_name: usersMap.get(d.filer_id) ?? "Unknown",
      })));
    }

    } catch (err) {
      console.error("Failed to load disputes:", err);
    } finally {
      setLoading(false);
    }
  }

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
    loadData();
  }

  async function handleResolveDispute(disputeId: string, resolution: "Upheld" | "Dismissed") {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: resolution }),
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Failed to resolve dispute.");
    }

    setSubmitting(false);
    loadData();
  }

  const canFile = userRole === "Participant" && eventState === "ReviewObjectionWindow";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-[var(--bg-muted)] rounded animate-pulse" />
      </div>
    );
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
        <form onSubmit={handleFileDispute} className="card p-6 space-y-4 border-[var(--error)]">
          <div>
            <label htmlFor="dispute-reason" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
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
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-[var(--text-muted)]">
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
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  d.state === "Open" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  : d.state === "Upheld" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  : d.state === "Dismissed" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                }`}>
                  {d.state}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{d.reason}</p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Filed {new Date(d.created_at).toLocaleDateString()}
                </p>
                {/* Resolution buttons for organizers on open disputes */}
                {userRole === "Organizer" && (d.state === "Open" || d.state === "UnderReview") && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolveDispute(d.id, "Upheld")}
                      disabled={submitting}
                      className="rounded-md border border-[var(--error)] px-2.5 py-1 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors disabled:opacity-50"
                    >
                      Uphold
                    </button>
                    <button
                      onClick={() => handleResolveDispute(d.id, "Dismissed")}
                      disabled={submitting}
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
