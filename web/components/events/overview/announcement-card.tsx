import { Megaphone, ExternalLink } from "lucide-react";
import Link from "next/link";

export interface Announcement {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  authorRole: string;
  href?: string;
}

export function AnnouncementCard({ announcements, loading }: { announcements: Announcement[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 animate-pulse">
        <div className="h-6 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-1/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="w-5 h-5 text-[var(--text)]" />
        <h3 className="font-semibold text-[var(--text)]">Announcements</h3>
      </div>
      
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No announcements yet.</p>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="relative rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-4 hover:border-neutral-400 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text)]">
                      {ann.authorRole}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{ann.date}</span>
                  </div>
                  <h4 className="font-medium text-sm text-[var(--text)] mb-1">{ann.title}</h4>
                  <p className="text-sm text-[var(--text-secondary)]">{ann.excerpt}</p>
                </div>
                {ann.href && (
                  <Link href={ann.href} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title="View Full">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
