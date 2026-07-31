export default function EscrowLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded bg-[var(--bg-muted)]" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 rounded-xl bg-[var(--bg-muted)]" />
        <div className="h-64 rounded-xl bg-[var(--bg-muted)]" />
      </div>
      <div className="h-[400px] rounded-xl bg-[var(--bg-muted)]" />
    </div>
  );
}
