import { CheckCircle2, Circle } from "lucide-react";

export interface MilestoneItem {
  id: string;
  label: string;
  completed: boolean;
}

export function MilestoneCard({ items, loading }: { items: MilestoneItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 animate-pulse">
        <div className="h-6 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
        <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-5 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text)]">Milestone Progress</h3>
        <span className="text-sm font-medium text-[var(--text-muted)]">
          {completedCount} / {totalCount} Complete
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 mb-6 overflow-hidden">
        <div 
          className="h-full bg-[var(--accent)] transition-all duration-500 ease-out" 
          style={{ width: `${totalCount === 0 ? 0 : (completedCount / totalCount) * 100}%` }}
        />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No milestones available.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600 shrink-0" aria-hidden="true" />
              )}
              <span className={`text-sm ${item.completed ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                {item.label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
