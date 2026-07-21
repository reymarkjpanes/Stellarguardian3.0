export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-[var(--bg-muted)]" />
        <div className="h-9 w-32 rounded-md bg-[var(--bg-muted)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-[var(--bg-muted)]" />
        ))}
      </div>
    </div>
  );
}
