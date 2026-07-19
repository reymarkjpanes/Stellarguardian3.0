/**
 * Event judging page — scoring interface for judges.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Submission {
  id: string;
  team_name: string;
  submitter_name: string;
  content: Record<string, unknown>;
  status: string;
}

interface Evaluation {
  id: string;
  submission_id: string;
  scores: Record<string, number>;
  feedback: string | null;
}

export default function EventJudgingPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [myEvaluations, setMyEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [eventId]);

  async function loadData() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
      .select("id, submitter_id, team_id, content, status")
      .eq("event_id", eventId)
      .eq("status", "Submitted");

    if (subs && subs.length > 0) {
      const submitterIds = subs.map((s) => s.submitter_id);
      const teamIds = subs.filter((s) => s.team_id).map((s) => s.team_id!);

      const [{ data: users }, { data: teams }] = await Promise.all([
        supabase.from("users").select("id, display_name").in("id", submitterIds),
        teamIds.length > 0
          ? supabase.from("teams").select("id, name").in("id", teamIds)
          : Promise.resolve({ data: [] }),
      ]);

      const usersMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));
      const teamsMap = new Map((teams ?? []).map((t) => [t.id, t.name]));

      setSubmissions(subs.map((s) => ({
        ...s,
        team_name: s.team_id ? teamsMap.get(s.team_id) ?? "" : "",
        submitter_name: usersMap.get(s.submitter_id) ?? "Unknown",
      })));
    }

    // Get my evaluations
    const { data: evals } = await supabase
      .from("evaluations")
      .select("id, submission_id, scores, feedback")
      .eq("event_id", eventId)
      .eq("judge_id", user.id);
    setMyEvaluations(evals ?? []);

    setLoading(false);
  }

  async function handleScore(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSub) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: selectedSub,
        scores,
        feedback: feedback || undefined,
      }),
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Failed to submit.");
      setSubmitting(false);
      return;
    }

    setSelectedSub(null);
    setScores({});
    setFeedback("");
    setSubmitting(false);
    loadData();
  }

  const isJudge = userRole === "Judge";
  const evaluatedIds = new Set(myEvaluations.map((e) => e.submission_id));

  if (loading) {
    return <div className="animate-pulse h-8 w-32 bg-[var(--bg-muted)] rounded" />;
  }

  if (!isJudge) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          Only judges can access the scoring interface.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Judging</h2>
        <span className="text-xs text-[var(--text-muted)]">
          {myEvaluations.length}/{submissions.length} scored
        </span>
      </div>

      {/* Scoring form */}
      {selectedSub && (
        <form onSubmit={handleScore} className="card p-6 space-y-4">
          <h3 className="font-medium">Score Submission</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Innovation", "Technical", "Impact"].map((criterion) => (
              <div key={criterion}>
                <label className="block text-xs text-[var(--text-muted)] mb-1">{criterion} (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scores[criterion.toLowerCase()] ?? ""}
                  onChange={(e) => setScores({ ...scores, [criterion.toLowerCase()]: +e.target.value })}
                  required
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Feedback (optional)</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Score"}
            </button>
            <button type="button" onClick={() => setSelectedSub(null)} className="text-sm text-[var(--text-muted)]">Cancel</button>
          </div>
        </form>
      )}

      {/* Submission list */}
      {submissions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No submissions to judge yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => {
            const isScored = evaluatedIds.has(sub.id);
            return (
              <div key={sub.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {sub.team_name || sub.submitter_name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {(sub.content as { title?: string })?.title ?? "Untitled"}
                  </p>
                </div>
                {isScored ? (
                  <span className="rounded-full bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 px-2.5 py-0.5 text-xs font-medium">
                    ✓ Scored
                  </span>
                ) : (
                  <button
                    onClick={() => setSelectedSub(sub.id)}
                    className="btn-primary px-3 py-1.5 text-xs font-medium rounded-md"
                  >
                    Score
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
