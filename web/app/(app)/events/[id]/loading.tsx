export default function EventLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Sub-nav skeleton */}
      <div className="h-20 rounded-md bg-[var(--bg-muted)]" />
      {/* Content skeleton */}
      <div className="space-y-3 pt-4">
        <div className="h-7 w-64 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-96 rounded bg-[var(--bg-muted)]" />
        <div className="grid gap-3 sm:grid-cols-2 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-[var(--bg-muted)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
