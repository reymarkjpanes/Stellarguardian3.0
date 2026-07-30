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
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "submitted"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : s === "draft"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : "bg-[var(--badge-bg)] text-[var(--badge-text)]";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

// ─── Phase gate ───────────────────────────────────────────────────────────────

function PhaseGate({ state }: { state: string }) {
  const messages: Record<string, string> = {
    Draft: "Submissions open once the organizer starts the submission phase.",
    Published: "Submissions open once the organizer starts the submission phase.",
    RegistrationOpen: "Submissions open after registration closes.",
    RegistrationClosed: "Submissions open when the submission phase begins.",
    SubmissionClosed: "Submissions have closed.",
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

// ─── Submissions list (organizer / judge / read-only view) ────────────────────

function SubmissionsList({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-[var(--text-muted)]">No submissions yet.</p>
      </div>
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
}: Props) {
  const isParticipant = userRole === "Participant";
  const submissionOpen = eventState === "SubmissionOpen";

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

  // ── Participant: wrong phase ───────────────────────────────────────────────
  if (!submissionOpen) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">Submissions</h2>
        {submissionDeadline && (
          <p className="text-xs text-[var(--text-muted)] mb-2">
            Deadline: {new Date(submissionDeadline).toLocaleDateString()}
          </p>
        )}
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
  if (!teamId) {
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
  const mySubmission = submissions.find((s) => s.team_id === teamId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          {teamName ? `${teamName}'s Submission` : "Your Submission"}
        </h2>
        {mySubmission && (
          <StatusBadge status={mySubmission.status} />
        )}
      </div>
      
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
              <a
                href={`/events/${eventId}/submissions/new`}
                className="inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                Edit Submission
              </a>
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
    </div>
  );
}
