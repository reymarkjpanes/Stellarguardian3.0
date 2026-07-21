export default function TeamsLoading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-6 w-16 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-14 rounded bg-[var(--bg-muted)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-[var(--bg-muted)]" />
        ))}
      </div>
    </div>
  );
}
