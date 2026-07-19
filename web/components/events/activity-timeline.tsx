/**
 * Activity Timeline — chronological feed of event activity.
 * Fetches from GET /api/events/[id]/activity and renders a vertical timeline.
 */
"use client";

import { useState, useEffect } from "react";

interface ActivityEntry {
  id: string;
  action: string;
  actor_id: string;
  actor_name?: string;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  "event.created": "Event created",
  "event.state_changed": "State changed",
  "member.joined": "Member joined",
  "member.approved": "Member approved",
  "member.rejected": "Member rejected",
  "team.created": "Team created",
  "submission.created": "Submission uploaded",
  "evaluation.created": "Score submitted",
  "evaluation.conflict_of_interest": "CoI flagged",
  "dispute.filed": "Dispute filed",
  "dispute.resolved": "Dispute resolved",
  "escrow.funded": "Escrow funded",
  "escrow.disbursed": "Prizes disbursed",
  "escrow.refunded": "Funds refunded",
  "winner.assigned": "Winners assigned",
};

export function ActivityTimeline({ eventId }: { eventId: string }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${eventId}/activity?limit=20`);
        if (res.ok) {
          const { data } = await res.json();
          setActivities(data ?? []);
        }
      } catch {
        // Silently fail — timeline is non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-[var(--bg-muted)] rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--text-muted)]">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-[var(--border)]" />

      <div className="space-y-4">
        {activities.map((entry) => (
          <div key={entry.id} className="relative flex gap-4 pl-8">
            {/* Dot */}
            <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-[var(--border)] bg-[var(--bg)]" />

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium text-[var(--text)]">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatRelativeTime(entry.created_at)}
                </span>
              </div>
              {entry.details && Object.keys(entry.details).length > 0 && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                  {formatDetails(entry.action, entry.details)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

function formatDetails(action: string, details: Record<string, unknown>): string {
  if (action === "event.state_changed" && details.from && details.to) {
    return `${details.from} → ${details.to}`;
  }
  if (details.reason) return String(details.reason);
  if (details.amount) return `${details.amount} XLM`;
  if (details.team_name) return String(details.team_name);
  return "";
}
