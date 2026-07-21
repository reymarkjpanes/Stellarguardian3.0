export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6 py-8 max-w-7xl mx-auto px-4">
      <div className="h-8 w-48 rounded-md bg-[var(--bg-muted)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-[var(--bg-muted)]" />
        ))}
      </div>
    </div>
  );
}
