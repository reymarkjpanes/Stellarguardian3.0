/**
 * Event submissions page — submit projects and view submissions.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Submission {
  id: string;
  team_id: string | null;
  submitter_id: string;
  status: string;
  current_version: number;
  updated_at: string;
  team_name?: string;
  submitter_name?: string;
}

export default function EventSubmissionsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventState, setEventState] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: event } = await supabase
      .from("events")
      .select("state")
      .eq("id", eventId)
      .single();
    setEventState(event?.state ?? "");

    const { data: membership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    setUserRole(membership?.role ?? null);

    // Get submissions
    const { data: subs } = await supabase
      .from("submissions")
      .select("id, team_id, submitter_id, status, current_version, updated_at")
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false });

    if (subs && subs.length > 0) {
      // Enrich with team names and submitter names
      const teamIds = [...new Set(subs.filter((s) => s.team_id).map((s) => s.team_id!))];
      const submitterIds = [...new Set(subs.map((s) => s.submitter_id))];

      const [{ data: teams }, { data: users }] = await Promise.all([
        teamIds.length > 0
          ? supabase.from("teams").select("id, name").in("id", teamIds)
          : Promise.resolve({ data: [] }),
        supabase.from("users").select("id, display_name").in("id", submitterIds),
      ]);

      const teamsMap = new Map((teams ?? []).map((t) => [t.id, t.name]));
      const usersMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));

      setSubmissions(subs.map((s) => ({
        ...s,
        team_name: s.team_id ? teamsMap.get(s.team_id) ?? "Unknown Team" : undefined,
        submitter_name: usersMap.get(s.submitter_id) ?? "Unknown",
      })));
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user has a team
    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Find if team belongs to this event
    let teamId: string | null = null;
    if (teamMembership) {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("id", teamMembership.team_id)
        .eq("event_id", eventId)
        .maybeSingle();
      teamId = team?.id ?? null;
    }

    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .insert({
        event_id: eventId,
        team_id: teamId,
        submitter_id: user.id,
        status: "Submitted",
        current_version: 1,
        content: { title, description, projectUrl },
      })
      .select()
      .single();

    if (subErr) {
      setError(subErr.message);
      setSubmitting(false);
      return;
    }

    setTitle("");
    setDescription("");
    setProjectUrl("");
    setShowForm(false);
    setSubmitting(false);
    loadData();
  }

  const canSubmit = userRole === "Participant" && eventState === "SubmissionOpen";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-[var(--bg-muted)] rounded animate-pulse" />
        <div className="h-24 bg-[var(--bg-muted)] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Submissions</h2>
        {canSubmit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-1.5 text-sm font-medium rounded-md"
          >
            Submit Project
          </button>
        )}
      </div>

      {/* Submission form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label htmlFor="sub-title" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Project Title
            </label>
            <input
              id="sub-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label htmlFor="sub-url" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Project URL (GitHub, demo, etc.)
            </label>
            <input
              id="sub-url"
              type="url"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label htmlFor="sub-desc" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <textarea
              id="sub-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-5 py-2 text-sm font-medium rounded-md disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Submissions list */}
      {submissions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {eventState === "SubmissionOpen"
              ? "No submissions yet."
              : "Submissions will be accepted during the SubmissionOpen phase."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => (
            <div key={sub.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {sub.team_name ?? sub.submitter_name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    v{sub.current_version} · {sub.status} · Updated {new Date(sub.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  sub.status === "Submitted"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                }`}>
                  {sub.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
