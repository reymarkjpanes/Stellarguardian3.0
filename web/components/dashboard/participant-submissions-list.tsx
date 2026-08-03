"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

interface ParticipantEventItem {
  event_id: string;
  role: string;
  event_title: string;
  event_state: string;
  team_name?: string;
  submission_status?: string;
  submission_title?: string;
  submission_id?: string;
  escrow_state?: string;
}

export function ParticipantSubmissionsList({ events }: { events: ParticipantEventItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? events.filter(
        (e) =>
          e.event_title.toLowerCase().includes(search.toLowerCase()) ||
          (e.submission_title && e.submission_title.toLowerCase().includes(search.toLowerCase())) ||
          (e.team_name && e.team_name.toLowerCase().includes(search.toLowerCase())),
      )
    : events;

  return (
    <div className="space-y-4">
      {events.length > 3 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter your submissions…"
          className="w-full sm:w-64 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-4">
          {search ? "No submissions match your filter." : "No submissions yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <div
              key={`${event.event_id}-${event.role}`}
              className="rounded-lg card overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-[var(--border)] flex items-start justify-between bg-[var(--bg-muted)]">
                <div>
                  <h3
                    className="font-semibold text-[var(--text)] line-clamp-1"
                    title={event.event_title}
                  >
                    {event.event_title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    State: {event.event_state.replace(/_/g, " ")}
                  </p>
                </div>
                {event.submission_status && <StatusBadge status={event.submission_status} />}
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3">
                {event.submission_title ? (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                      Project Name
                    </p>
                    <p className="font-medium text-[var(--text)]">{event.submission_title}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                      Project Name
                    </p>
                    <p className="font-medium text-[var(--text-muted)] italic">Not set yet</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Team</p>
                  <p className="font-medium text-[var(--text)]">{event.team_name || "No team"}</p>
                </div>

                {(event.event_state === "Completed" ||
                  event.event_state === "Winners_Announced" ||
                  event.event_state === "Escrow") && (
                  <div className="pt-2 border-t border-[var(--border)] mt-auto">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
                      Status
                    </p>
                    <div className="flex gap-2">
                      <span className="inline-flex rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text)]">
                        Evaluated
                      </span>
                      {event.escrow_state && (
                        <span className="inline-flex rounded-full bg-blue-500/10 text-blue-500 px-2 py-0.5 text-xs font-medium">
                          Payout: {event.escrow_state.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 pt-0">
                <a
                  href={`/events/${event.event_id}/submissions`}
                  className="w-full inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
                >
                  Manage Submission
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
