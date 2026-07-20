import { ArrowRight } from "lucide-react";
import Link from "next/link";

export interface ActionItem {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

export function QuickActionsCard({ actions, title = "Quick Actions", loading }: { actions: ActionItem[]; title?: string; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 animate-pulse">
        <div className="h-6 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 w-full rounded-md bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <h3 className="font-semibold text-[var(--text)] mb-4">{title}</h3>
      <div className="space-y-3">
        {actions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No actions available.</p>
        ) : (
          actions.map((action) => {
            const className = action.primary
              ? "flex w-full items-center justify-between rounded-md bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] transition-colors"
              : "flex w-full items-center justify-between rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors";
            
            if (action.href) {
              return (
                <Link key={action.id} href={action.href} className={className}>
                  {action.label}
                  <ArrowRight className="w-4 h-4 opacity-70" aria-hidden="true" />
                </Link>
              );
            }
            
            return (
              <button key={action.id} onClick={action.onClick} className={className}>
                {action.label}
                <ArrowRight className="w-4 h-4 opacity-70" aria-hidden="true" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
