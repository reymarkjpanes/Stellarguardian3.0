export interface RoleStat {
  label: string;
  value: string | number;
}

export function RoleSummaryCard({ role, stats, loading }: { role: string; stats: RoleStat[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-5 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text)]">Role Summary</h3>
        <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-[var(--text)]">
          {role}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {stats.length === 0 ? (
          <p className="col-span-2 text-sm text-[var(--text-muted)]">No stats available.</p>
        ) : (
          stats.map((stat, i) => (
            <div key={i} className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-muted)] p-3">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{stat.label}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--text)]">{stat.value}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
