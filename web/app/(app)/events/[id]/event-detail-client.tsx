"use client";

/**
 * Event detail — Overview tab content only.
 *
 * Navigation between Teams / Submissions / Judging / etc. is handled by
 * EventSubNav in layout.tsx, which links to dedicated sub-pages.
 * This component renders what lives at /events/[id] (the Overview route).
 *
 * SECURITY: All mutations route through API endpoints.
 * - State changes → PATCH /api/events/[id]/state
 * - Member applications → POST /api/events/[id]/register
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventActionCenter } from "@/components/events/overview/event-action-center";

interface EventDetailClientProps {
  event: Record<string, unknown>;
  members: Array<{ user_id: string; role: string; status: string }>;
  teams: Array<{
    id: string;
    name: string;
    captain_id: string;
    team_members: Array<{ user_id: string; joined_at: string }>;
  }>;
  isOrganizer: boolean;
  myMembership: { user_id: string; role: string; status: string } | null;
  userId: string | null;
  judgeCount: number;
  hasVerifiedOrganizer: boolean;
  hasVerifiedWallet: boolean;
  submissionStatus: string | null;
  reviewWindowHours: number;
}

export function EventDetailClient({
  event,
  members,
  teams,
  isOrganizer,
  myMembership,
  userId,
  hasVerifiedWallet,
  submissionStatus,
}: EventDetailClientProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleApply() {
    if (!userId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "Participant" }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        setActionError(error?.message ?? "Failed to apply.");
        return;
      }
      router.refresh();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStateChange(newState: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_state: newState,
          version: event.version as number,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        setActionError(error?.message ?? "State transition failed.");
        return;
      }
      router.refresh();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  const roleName = isOrganizer ? "Organizer" : myMembership ? myMembership.role : "Guest";
  const isInTeam = teams.some((t) => t.team_members?.some((m) => m.user_id === userId));

  // Submission status flags — derived from server-fetched state
  const hasSubmission = !!submissionStatus;
  const isSubmitted =
    submissionStatus === "Submitted" ||
    submissionStatus === "SUBMITTED" ||
    submissionStatus === "LOCKED" ||
    submissionStatus === "Locked";

  const milestones = [
    { id: "registered", label: "Registered for Event", completed: !!myMembership },
    { id: "team", label: "Joined a Team", completed: isInTeam },
    { id: "wallet", label: "Wallet Connected", completed: hasVerifiedWallet },
    { id: "repo", label: "Repository Added", completed: hasSubmission },
    { id: "demo", label: "Demo Uploaded", completed: hasSubmission },
    { id: "submitted", label: "Final Submitted", completed: isSubmitted },
  ];

  const quickActions = isOrganizer
    ? [
        { id: "members", label: "Manage Members", href: `/events/${event.id}/members` },
        { id: "subs", label: "Review Submissions", href: `/events/${event.id}/submissions` },
        { id: "escrow", label: "Escrow & Prizes", href: `/events/${event.id}/escrow` },
      ]
    : myMembership
      ? [
          {
            id: "team",
            label: isInTeam ? "My Team" : "Find or Create a Team",
            href: `/events/${event.id}/teams`,
            primary: !isInTeam,
          },
          {
            id: "sub",
            label: isSubmitted
              ? "View Submission"
              : hasSubmission
                ? "Continue Submission"
                : "Start Submission",
            href: `/events/${event.id}/submissions`,
            primary: isInTeam && !isSubmitted,
          },
        ]
      : [{ id: "apply", label: "Apply to Participate", onClick: handleApply, primary: true }];

  const roleStats = isOrganizer
    ? [
        { label: "Participants", value: members.filter((m) => m.role === "Participant").length },
        { label: "Teams Formed", value: teams.length },
      ]
    : [
        { label: "Team Status", value: isInTeam ? "Joined" : "No Team" },
        {
          label: "Submission",
          value: isSubmitted ? "Submitted ✓" : hasSubmission ? "Draft" : "Not Started",
        },
      ];

  const recentActivities = [
    ...teams.map((t) => ({
      id: `team-${t.id}`,
      timeAgo: "Recently",
      description: `Team ${t.name} was created.`,
    })),
    ...members.slice(0, 3).map((m) => ({
      id: `mem-${m.user_id}`,
      timeAgo: "Recently",
      description: `A new ${m.role.toLowerCase()} joined the event.`,
    })),
  ].slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Error display */}
      {actionError && (
        <div
          className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 flex items-center justify-between"
          role="alert"
        >
          <p className="text-sm text-[var(--error)]">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-xs text-[var(--error)] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview action center */}
      <EventActionCenter
        eventName={event.title as string}
        currentPhase={event.state as string}
        countdownText="Deadline to be announced"
        heroPrimaryActionLabel={!myMembership ? "Apply to Participate" : "Continue Workspace"}
        onHeroPrimaryAction={
          !myMembership
            ? handleApply
            : () => router.push(`/events/${event.id as string}/submissions`)
        }
        role={roleName}
        milestones={milestones}
        quickActions={quickActions}
        roleStats={roleStats}
        announcements={[]}
        activities={recentActivities}
      />

      {/* Organizer lifecycle controls */}
      {isOrganizer && (
        <div className="space-y-4 pt-2 border-t border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">Lifecycle Controls</h2>
          <div className="flex flex-wrap gap-2">
            {event.state === "Draft" && (
              <ActionButton
                label="Publish"
                onClick={() => handleStateChange("Published")}
                disabled={actionLoading}
              />
            )}
            {event.state === "Published" && (
              <ActionButton
                label="Open Registration"
                onClick={() => handleStateChange("RegistrationOpen")}
                disabled={actionLoading}
              />
            )}
            {event.state === "RegistrationOpen" && (
              <ActionButton
                label="Close Registration"
                onClick={() => handleStateChange("RegistrationClosed")}
                disabled={actionLoading}
              />
            )}
            {event.state === "RegistrationClosed" && (
              <ActionButton
                label="Start Team Formation"
                onClick={() => handleStateChange("TeamFormationLocked")}
                disabled={actionLoading}
              />
            )}
            {event.state === "TeamFormationLocked" && (
              <ActionButton
                label="Open Submissions"
                onClick={() => handleStateChange("SubmissionOpen")}
                disabled={actionLoading}
              />
            )}
            {event.state === "SubmissionOpen" && (
              <ActionButton
                label="Close Submissions"
                onClick={() => handleStateChange("SubmissionClosed")}
                disabled={actionLoading}
              />
            )}
            {event.state === "SubmissionClosed" && (
              <ActionButton
                label="Begin Judging"
                onClick={() => handleStateChange("JudgingRound1")}
                disabled={actionLoading}
              />
            )}
            {event.state === "JudgingRound1" && (
              <ActionButton
                label="Open Review Window"
                onClick={() => handleStateChange("DisputeWindow")}
                disabled={actionLoading}
              />
            )}
            {event.state === "DisputeWindow" && (
              <ActionButton
                label="Finalize Winners"
                onClick={() => handleStateChange("WinnerVerification")}
                disabled={actionLoading}
              />
            )}
            {event.state === "WinnerVerification" && (
              <ActionButton
                label="Request Escrow Funding"
                onClick={() => handleStateChange("PrizeApproved")}
                disabled={actionLoading}
              />
            )}
            {event.state === "PrizeApproved" && (
              <ActionButton
                label="Release Escrow"
                onClick={() => handleStateChange("EscrowRelease")}
                disabled={actionLoading}
              />
            )}
            {event.state === "EscrowRelease" && (
              <ActionButton
                label="Mark Completed"
                onClick={() => handleStateChange("Completed")}
                disabled={actionLoading}
              />
            )}
            {event.state === "Completed" && (
              <ActionButton
                label="Archive"
                onClick={() => handleStateChange("Archived")}
                disabled={actionLoading}
              />
            )}
            <button
              onClick={() => {
                if (confirm("Cancel this event? This cannot be undone."))
                  handleStateChange("Cancelled");
              }}
              className="rounded-md border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors disabled:opacity-50"
              disabled={actionLoading}
            >
              Cancel Event
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
    >
      {label}
    </button>
  );
}
