import { Activity } from "lucide-react";

export interface ActivityItem {
  id: string;
  timeAgo: string;
  description: string;
}

export function ActivityFeedCard({
  activities,
  loading,
}: {
  activities: ActivityItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 animate-pulse">
        <div className="h-6 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-1/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
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
        <Activity className="w-5 h-5 text-[var(--text)]" />
        <h3 className="font-semibold text-[var(--text)]">Recent Activity</h3>
      </div>

      <div className="relative space-y-0">
        {activities.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No recent activity.</p>
        ) : (
          <div className="border-l-2 border-[var(--border)] ml-2 pl-4 py-1 space-y-6">
            {activities.map((activity) => (
              <div key={activity.id} className="relative">
                <div className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--accent)] outline outline-4 outline-[var(--card-bg)]" />
                <p className="text-xs font-medium text-[var(--text-muted)] mb-1">
                  {activity.timeAgo}
                </p>
                <p className="text-sm text-[var(--text)]">{activity.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
