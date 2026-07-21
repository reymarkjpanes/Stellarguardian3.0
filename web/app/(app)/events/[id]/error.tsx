"use client";

export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[30vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <div className="h-10 w-10 rounded-full bg-[var(--error-bg)] flex items-center justify-center text-[var(--error)]">
        ✕
      </div>
      <h2 className="text-base font-semibold text-[var(--text)]">Event failed to load</h2>
      <p className="text-sm text-[var(--text-muted)] max-w-sm">
        {error.message || "An error occurred loading this event."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
