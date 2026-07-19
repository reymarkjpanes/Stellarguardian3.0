/**
 * Event winners page — view winners and (for organizers) assign prizes.
 *
 * Organizers can select submissions/participants and assign prize amounts.
 * Uses POST /api/events/[id]/winners endpoint.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface Winner {
  id: string;
  recipient_id: string;
  team_id: string | null;
  prize_amount: number;
  disbursement_status: string;
  recipient_name?: string;
  team_name?: string;
}

interface Submission {
  id: string;
  submitter_id: string;
  team_id: string | null;
  submitter_name: string;
  team_name: string | null;
}

interface WinnerDraft {
  recipient_id: string;
  team_id: string | null;
  prize_amount: string;
  label: string;
}

export default function EventWinnersPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [winners, setWinners] = useState<Winner[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [eventState, setEventState] = useState("");

  // Selection form state
  const [showForm, setShowForm] = useState(false);
  const [drafts, setDrafts] = useState<WinnerDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: event }, { data: membership }] = await Promise.all([
      supabase.from("events").select("state").eq("id", eventId).single(),
      supabase
        .from("event_members")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    setEventState(event?.state ?? "");
    setIsOrganizer(membership?.role === "Organizer");

    // Load existing winners - order by prize_amount desc (placement may not exist yet)
    const { data: winnersData } = await supabase
      .from("winners")
      .select("*")
      .eq("event_id", eventId)
      .order("prize_amount", { ascending: false });

    if (winnersData && winnersData.length > 0) {
      const recipientIds = winnersData.map((w) => w.recipient_id);
      const teamIds = winnersData.filter((w) => w.team_id).map((w) => w.team_id!);

      const [{ data: users }, { data: teams }] = await Promise.all([
        supabase.from("users").select("id, display_name").in("id", recipientIds),
        teamIds.length > 0
          ? supabase.from("teams").select("id, name").in("id", teamIds)
          : Promise.resolve({ data: [] }),
      ]);

      const usersMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));
      const teamsMap = new Map((teams ?? []).map((t) => [t.id, t.name]));

      setWinners(
        winnersData.map((w) => ({
          ...w,
          recipient_name: usersMap.get(w.recipient_id) ?? "Unknown",
          team_name: w.team_id ? (teamsMap.get(w.team_id) ?? null) : null,
        })),
      );
    }

    // Load submissions for selection (organizers)
    if (membership?.role === "Organizer") {
      const { data: subs } = await supabase
        .from("submissions")
        .select("id, submitter_id, team_id")
        .eq("event_id", eventId)
        .eq("status", "Submitted");

      if (subs && subs.length > 0) {
        const submitterIds = [...new Set(subs.map((s) => s.submitter_id))];
        const subTeamIds = [...new Set(subs.filter((s) => s.team_id).map((s) => s.team_id!))];

        const [{ data: subUsers }, { data: subTeams }] = await Promise.all([
          supabase.from("users").select("id, display_name").in("id", submitterIds),
          subTeamIds.length > 0
            ? supabase.from("teams").select("id, name").in("id", subTeamIds)
            : Promise.resolve({ data: [] }),
        ]);

        const usersMap2 = new Map((subUsers ?? []).map((u) => [u.id, u.display_name]));
        const teamsMap2 = new Map((subTeams ?? []).map((t) => [t.id, t.name]));

        setSubmissions(
          subs.map((s) => ({
            ...s,
            submitter_name: usersMap2.get(s.submitter_id) ?? "Unknown",
            team_name: s.team_id ? (teamsMap2.get(s.team_id) ?? null) : null,
          })),
        );
      }
    }

    setLoading(false);
  }

  function addWinnerDraft(sub: Submission) {
    setDrafts([
      ...drafts,
      {
        recipient_id: sub.submitter_id,
        team_id: sub.team_id,
        prize_amount: "",
        label: sub.team_name ?? sub.submitter_name,
      },
    ]);
  }

  function removeDraft(index: number) {
    setDrafts(drafts.filter((_, i) => i !== index));
  }

  function updateDraftAmount(index: number, value: string) {
    const updated = [...drafts];
    updated[index] = { ...updated[index]!, prize_amount: value };
    setDrafts(updated);
  }

  async function handleAssignWinners() {
    setSubmitting(true);
    setError(null);

    const winnersPayload = drafts.map((d) => ({
      recipient_id: d.recipient_id,
      team_id: d.team_id,
      prize_amount: Number(d.prize_amount),
    }));

    if (winnersPayload.some((w) => !w.prize_amount || w.prize_amount <= 0)) {
      setError("All winners must have a positive prize amount.");
      setSubmitting(false);
      return;
    }

    const res = await fetch(`/api/events/${eventId}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winners: winnersPayload }),
    });

    if (!res.ok) {
      const { error: apiErr } = await res.json();
      setError(apiErr?.message ?? "Failed to assign winners.");
      setSubmitting(false);
      return;
    }

    setDrafts([]);
    setShowForm(false);
    setSubmitting(false);
    loadData();
  }

  const canAssignWinners =
    isOrganizer &&
    winners.length === 0 &&
    ["Judging", "ReviewObjectionWindow", "WinnersFinalized"].includes(eventState);

  if (loading) {
    return <div className="h-8 w-32 bg-[var(--bg-muted)] rounded animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Winners & Prizes</h2>
        {canAssignWinners && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-1.5 text-sm font-medium rounded-md"
          >
            Assign Winners
          </button>
        )}
      </div>

      {error && (
        <div
          className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Winner assignment form */}
      {showForm && (
        <div className="card p-6 space-y-4">
          <h3 className="font-medium text-[var(--text)]">Select Winners</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Choose submissions to award prizes. Each winner receives the specified XLM amount from
            the escrow.
          </p>

          {/* Available submissions to select from */}
          {submissions.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">Available submissions:</p>
              <div className="flex flex-wrap gap-2">
                {submissions
                  .filter((s) => !drafts.some((d) => d.recipient_id === s.submitter_id))
                  .map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => addWinnerDraft(sub)}
                      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      + {sub.team_name ?? sub.submitter_name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Selected winners with prize amounts */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              {drafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-md border border-[var(--border)] p-3"
                >
                  <div className="h-7 w-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-sm font-medium text-[var(--text)]">
                    {draft.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.prize_amount}
                      onChange={(e) => updateDraftAmount(idx, e.target.value)}
                      placeholder="XLM"
                      className="w-24 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">XLM</span>
                    <button
                      onClick={() => removeDraft(idx)}
                      className="text-[var(--error)] text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  Total:{" "}
                  <strong>
                    {drafts.reduce((sum, d) => sum + (Number(d.prize_amount) || 0), 0)} XLM
                  </strong>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setDrafts([]);
                    }}
                    className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignWinners}
                    disabled={submitting || drafts.length === 0}
                    className="btn-primary px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Confirm Winners"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing winners display */}
      {winners.length === 0 && !showForm ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">Winners have not been announced yet.</p>
        </div>
      ) : (
        winners.length > 0 && (
          <div className="space-y-3">
            {winners.map((w, idx) => (
              <div
                key={w.id}
                className="card p-4 flex items-center justify-between hover:bg-[var(--bg-muted)]/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      {w.team_name ?? w.recipient_name}
                    </p>
                    {w.team_name && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Individual: {w.recipient_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-[var(--primary)]">{w.prize_amount} XLM</p>
                  <p className="text-xs text-[var(--text-muted)] capitalize">
                    {w.disbursement_status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
