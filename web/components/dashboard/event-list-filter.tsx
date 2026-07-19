/**
 * Client-side event list with search filter and duplicate action (M7, M10).
 */
"use client";

import { useState } from "react";

interface EventItem {
  event_id: string;
  role: string;
  status: string;
  event_title: string;
  event_state: string;
}

export function EventListFilter({ events }: { events: EventItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? events.filter((e) =>
        e.event_title.toLowerCase().includes(search.toLowerCase()) ||
        e.role.toLowerCase().includes(search.toLowerCase()) ||
        e.event_state.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className="space-y-3">
      {/* Search input */}
      {events.length > 3 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter events…"
          className="w-full sm:w-64 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      )}

      {/* Event list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-4">
          {search ? "No events match your filter." : "No events yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => (
            <div
              key={`${event.event_id}-${event.role}`}
              className="rounded-lg card p-4 flex items-center justify-between group"
            >
              <a
                href={`/events/${event.event_id}`}
                className="flex-1 min-w-0 hover:text-[var(--accent)] transition-colors"
              >
                <p className="font-medium text-[var(--text)] truncate">{event.event_title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {event.role} · {event.event_state}
                </p>
              </a>
              <div className="flex items-center gap-2">
                <span className="rounded-full badge-default px-2.5 py-0.5 text-xs font-medium">
                  {event.role}
                </span>
                {event.role === "Organizer" && (
                  <a
                    href={`/events/new?duplicate=${event.event_id}`}
                    title="Duplicate this event"
                    className="opacity-0 group-hover:opacity-100 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-all"
                  >
                    ⎘
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
