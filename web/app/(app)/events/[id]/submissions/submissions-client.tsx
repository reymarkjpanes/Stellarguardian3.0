"use client";

/**
 * Submissions tab — context-aware rendering:
 *
 *  Participant + team + SubmissionOpen  → Full submission hub
 *    (requirements checklist, auto-save, validation panel, submit)
 *  Participant + no team + SubmissionOpen → "Join a team first" nudge
 *  Participant + wrong phase → Phase gate message
 *  Organizer / Judge / any other role   → Read-only submissions list
 */

import { useState, useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Submission {
  id: string;
  team_id: string | null;
  submitter_id: string;
  status: string;
  current_version: number;
  updated_at: string;
  team_name?: string;
  submitter_name?: string;
  title?: string;
  github_url?: string;
}

interface Props {
  eventId: string;
  eventName: string;
  eventState: string;
  submissionDeadline: string | null;
  submissions: Submission[];
  userRole: string | null;
  userId: string | null;
  teamId: string | null;
  teamName: string | null;
  feedback?: JudgeFeedback[];
}

export interface JudgeFeedback {
  id: string;
  total_score: number | null;
  participant_feedback: string | null;
  scores: Record<string, number> | null;
}

function PhaseGate({ state }: { state: string }) {
  const messages: Record<string, string> = {
    Draft: "Submissions open once the organizer starts the submission phase.",
    Published: "Submissions open once the organizer starts the submission phase.",
    RegistrationOpen: "Submissions open after registration closes.",
    RegistrationClosed: "Submissions open when the submission phase begins.",
    SubmissionClosed: "Submissions are closed. Judging begins soon.",
    Judging: "Submissions are under review by judges.",
    Completed: "This event has completed.",
    Archived: "This event is archived.",
    Cancelled: "This event was cancelled.",
  };
  return (
    <div className="card p-10 text-center">
      <p className="text-sm text-[var(--text-muted)]">
        {messages[state] ?? `Submissions unavailable in ${state} phase.`}
      </p>
    </div>
  );
}

/** Inline banner shown to participants while judging is in progress (H1). */
function JudgingInProgressBanner({ state }: { state: string }) {
  const judgingStates = new Set([
    "JudgingRound1",
    "JudgingRound2",
    "WinnerVerification",
    "DisputeWindow",
  ]);
  if (!judgingStates.has(state)) return null;

  const message =
    state === "WinnerVerification"
      ? "Judging is complete — winners are being verified. Results will be published shortly."
      : state === "DisputeWindow"
        ? "Winners have been verified. The dispute window is open until the organizer approves prizes."
        : "Judging is in progress. Your submission is under review. Results will be available once judging completes.";

  return (
    <div
      role="status"
      className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-4 py-3 flex items-start gap-3"
    >
      <span className="text-[var(--accent)] text-base shrink-0 mt-0.5" aria-hidden="true">
        ⏳
      </span>
      <p className="text-sm text-[var(--accent)]">{message}</p>
    </div>
  );
}

// ─── Submissions list (organizer / judge / read-only view) ────────────────────

function SubmissionsList({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) {
    return (
      <EmptyState
        title="No submissions yet."
        description="Projects will appear here once teams submit them."
      />
    );
  }
  return (
    <div className="space-y-2">
      {submissions.map((sub) => (
        <div key={sub.id} className="card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">
              {sub.team_name ?? sub.submitter_name ?? "Unknown"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              v{sub.current_version} · Updated {new Date(sub.updated_at).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={sub.status} />
        </div>
      ))}
    </div>
  );
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────

function ViewFeedbackModal({
  isOpen,
  onClose,
  feedback,
}: {
  isOpen: boolean;
  onClose: () => void;
  feedback: JudgeFeedback[];
}) {
  if (!isOpen) return null;

  const validScores = feedback.filter((f) => typeof f.total_score === "number");
  const averageScore =
    validScores.length > 0
      ? validScores.reduce((acc, f) => acc + f.total_score!, 0) / validScores.length
      : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Judge Feedback">
      <div className="space-y-6 min-w-[400px] max-w-[600px]">
        <div className="flex flex-col items-center justify-center p-6 bg-[var(--bg-muted)] rounded-lg">
          <p className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Overall Average Score
          </p>
          <p className="text-4xl font-bold text-[var(--text)]">
            {averageScore !== null ? averageScore.toFixed(1) : "N/A"}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Based on {validScores.length} judge evaluation(s)
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Anonymous Judge Breakdown</h3>
          {feedback.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No feedback available.</p>
          ) : (
            feedback.map((f, i) => (
              <div key={f.id} className="card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span className="font-medium text-[var(--text)]">Judge {i + 1}</span>
                  <span className="font-bold text-[var(--accent)]">{f.total_score} / 100</span>
                </div>
                {f.participant_feedback ? (
                  <div className="text-sm text-[var(--text)] bg-[var(--bg-muted)] p-3 rounded italic">
                    &quot;{f.participant_feedback}&quot;
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">No comments provided.</p>
                )}

                {f.scores && Object.keys(f.scores).length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                      Rubric Scores:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(f.scores).map(([category, score]) => (
                        <div key={category} className="text-xs flex justify-between">
                          <span className="text-[var(--text-secondary)]">{category}:</span>
                          <span className="font-medium">{score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubmissionsClient({
  eventId,
  eventName,
  eventState,
  submissionDeadline,
  submissions,
  userRole,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId,
  teamId,
  teamName,
  feedback = [],
}: Props) {
  const isParticipant = userRole === "Participant";
  const submissionOpen = eventState === "SubmissionOpen";
  const isCompleted = eventState === "Completed";
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // M6: deadline countdown — computed in useEffect (post-render) to satisfy
  // react-hooks/purity which blocks Date.now() in render/useMemo.
  const [deadlineCountdown, setDeadlineCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!submissionDeadline) {
      setDeadlineCountdown(null);
      return;
    }
    function compute() {
      const ms = new Date(submissionDeadline!).getTime() - Date.now();
      if (ms <= 0) return "Submission deadline has passed";
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (days > 0) return `${days} day${days !== 1 ? "s" : ""} left to submit`;
      if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} left to submit`;
      return "Less than 1 hour left — submit now!";
    }
    setDeadlineCountdown(compute());
    // Refresh every minute so the countdown stays live
    const id = setInterval(() => setDeadlineCountdown(compute()), 60_000);
    return () => clearInterval(id);
  }, [submissionDeadline]);

  // ── Organizer / Judge — read-only list ────────────────────────────────────
  if (!isParticipant) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">{eventName} — Submissions</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {submissions.length} submission{submissions.length !== 1 && "s"}
          </span>
        </div>
        <SubmissionsList submissions={submissions} />
      </div>
    );
  }

  // ── Participant: no team ───────────────────────────────────────────────────
  const mySubmission = submissions.find((s) => s.team_id === teamId);

  // ── Participant: wrong phase (and no submission to show) ───────────────────
  if (!submissionOpen && !mySubmission) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">Submissions</h2>
        {submissionDeadline && (
          <p className="text-xs text-[var(--text-muted)] mb-2">
            Deadline: {new Date(submissionDeadline).toLocaleDateString()}
          </p>
        )}
        {/* H1: judging-in-progress banner so participants aren't left in the dark */}
        <JudgingInProgressBanner state={eventState} />
        <PhaseGate state={eventState} />
        {/* Still show submitted projects if any exist */}
        {submissions.length > 0 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Submitted Projects
            </p>
            <SubmissionsList submissions={submissions} />
          </div>
        )}
      </div>
    );
  }

  // ── Participant: no team ───────────────────────────────────────────────────
  if (!teamId && submissionOpen) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">Submissions</h2>
        <div className="card p-8 text-center space-y-3">
          <p className="text-sm font-medium text-[var(--text)]">You need a team to submit</p>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Submissions are linked to teams. Join or create a team on the Teams tab, then come back
            here to submit your project.
          </p>
          <a
            href={`/events/${eventId}/teams`}
            className="inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Go to Teams
          </a>
        </div>
      </div>
    );
  }

  // ── Participant + team + SubmissionOpen → Full submission hub ──────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          {teamName ? `${teamName}'s Submission` : "Your Submission"}
        </h2>
        {mySubmission && <StatusBadge status={mySubmission.status} />}
      </div>

      {/* H1: judging banner even when participant has a submission on file */}
      <JudgingInProgressBanner state={eventState} />

      {/* M6: submission deadline countdown */}
      {deadlineCountdown && submissionOpen && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">⏱</span>
          <p className="text-xs font-medium text-[var(--text-secondary)]">{deadlineCountdown}</p>
          <span className="text-xs text-[var(--text-muted)] ml-auto">
            {new Date(submissionDeadline!).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {mySubmission ? (
        <div className="card p-6">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-[var(--text)]">
                {mySubmission.title || "Untitled Project"}
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                Last updated {new Date(mySubmission.updated_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              {mySubmission.github_url && (
                <a
                  href={mySubmission.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--badge-bg)] transition-colors"
                >
                  View GitHub
                </a>
              )}
              {isCompleted && (
                <button
                  onClick={() => setIsFeedbackModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-md bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:bg-[var(--text-secondary)] transition-colors"
                >
                  View Feedback
                </button>
              )}
              {submissionOpen && (
                <a
                  href={`/events/${eventId}/submissions/new`}
                  className="inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Edit Submission
                </a>
              )}
            </div>
          </div>
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="text-sm text-[var(--text-muted)]">
              {mySubmission.status === "DRAFT" || mySubmission.status === "Draft"
                ? "Your submission is currently a draft. Don't forget to submit final before the deadline."
                : "Your project has been successfully submitted!"}
            </p>
          </div>
        </div>
      ) : (
        <div className="card p-6 flex flex-col items-center justify-center space-y-4 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Manage your hackathon submission fields, links, and detailed description.
          </p>
          <a
            href={`/events/${eventId}/submissions/new`}
            className="inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Create Submission
          </a>
        </div>
      )}
      <ViewFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        feedback={feedback}
      />
    </div>
  );
}
