/**
 * Streamed loading state for the event overview page.
 *
 * The layout (EventSubNav) renders instantly from its own cache.
 * This skeleton covers only the page content below it.
 */
export default function EventLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Hero / action center skeleton */}
      <div className="rounded-xl border border-[var(--border)] p-6 space-y-4">
        <div className="h-5 w-24 rounded bg-[var(--bg-muted)]" />
        <div className="h-7 w-56 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-80 rounded bg-[var(--bg-muted)]" />
        <div className="flex gap-3 pt-2">
          <div className="h-9 w-36 rounded-md bg-[var(--bg-muted)]" />
          <div className="h-9 w-28 rounded-md bg-[var(--bg-muted)]" />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
            <div className="h-6 w-10 rounded bg-[var(--bg-muted)]" />
          </div>
        ))}
      </div>

      {/* Activity list skeleton */}
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]" />
        ))}
      </div>
    </div>
  );
}
