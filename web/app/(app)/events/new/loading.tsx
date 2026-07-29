export default function CreateEventLoading() {
  return (
    <div className="animate-pulse max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8 space-y-2">
        <div className="h-8 w-48 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-96 rounded bg-[var(--bg-muted)]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded bg-[var(--bg-muted)]" />
          ))}
        </div>
        <div className="lg:col-span-3">
          <div className="h-96 rounded-xl bg-[var(--bg-muted)]" />
        </div>
      </div>
    </div>
  );
}
