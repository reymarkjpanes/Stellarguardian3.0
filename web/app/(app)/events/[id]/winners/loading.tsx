export default function WinnersLoading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 rounded bg-[var(--bg-muted)]" />
        <div className="h-8 w-28 rounded-md bg-[var(--bg-muted)]" />
      </div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-[var(--bg-muted)]" />
        ))}
      </div>
    </div>
  );
}
