"use client";

/**
 * EventSubNav — horizontal tab bar for all event sub-pages (Task 2.5).
 *
 * Design: single-line sticky header under the app nav. Active tab uses a
 * bottom border accent. Scrollable on mobile (no wrapping).
 * Organizer tabs visible only to the event organizer.
 */
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
  organizerOnly?: boolean;
}

function getTabs(eventId: string): Tab[] {
  return [
    { label: "Overview", href: `/events/${eventId}` },
    { label: "Teams", href: `/events/${eventId}/teams` },
    { label: "Submissions", href: `/events/${eventId}/submissions` },
    { label: "Judging", href: `/events/${eventId}/judging` },
    { label: "Winners", href: `/events/${eventId}/winners` },
    { label: "Escrow", href: `/events/${eventId}/escrow`, organizerOnly: true },
    { label: "Disputes", href: `/events/${eventId}/disputes` },
    { label: "Members", href: `/events/${eventId}/members`, organizerOnly: true },
    { label: "Prizes", href: `/events/${eventId}/prizes`, organizerOnly: true },
  ];
}

interface EventSubNavProps {
  eventId: string;
  eventTitle: string;
  eventState: string;
  isOrganizer: boolean;
  /** Whether the current user is already an event member (hides Register tab if so). */
  isMember?: boolean;
}

export function EventSubNav({
  eventId,
  eventTitle,
  eventState,
  isOrganizer,
  isMember = false,
}: EventSubNavProps) {
  const pathname = usePathname();

  // L4: show Register tab only during RegistrationOpen, for non-members/non-organizers
  const showRegisterTab = eventState === "RegistrationOpen" && !isOrganizer && !isMember;

  const tabs = getTabs(eventId)
    .filter((t) => !t.organizerOnly || isOrganizer)
    .concat(showRegisterTab ? [{ label: "Register", href: `/events/${eventId}/register` }] : []);

  function isActive(tab: Tab): boolean {
    if (tab.href === `/events/${eventId}`) {
      // Overview is active only on the exact event root path
      return pathname === `/events/${eventId}` || pathname === `/events/${eventId}/`;
    }
    return pathname.startsWith(tab.href);
  }

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)] sticky top-14 z-30">
      <div className="space-y-0">
        {/* Event title + state badge */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <a
              href="/dashboard"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
            >
              Dashboard
            </a>
            <span className="text-xs text-[var(--text-muted)]">›</span>
            <h1 className="text-sm font-semibold text-[var(--text)] truncate">{eventTitle}</h1>
          </div>
          <span className="ml-auto shrink-0 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] whitespace-nowrap">
            {eventState}
          </span>
        </div>

        {/* Tab bar */}
        <nav
          className="flex gap-0 overflow-x-auto px-4 max-w-7xl mx-auto scrollbar-none"
          aria-label="Event sections"
        >
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
