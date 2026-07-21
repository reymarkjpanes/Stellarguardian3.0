"use client";

/**
 * App-level error boundary — catches errors in authenticated pages.
 * Shows a friendly message with retry/navigation options.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
      <div className="mx-auto h-12 w-12 rounded-full bg-[var(--error-bg)] flex items-center justify-center">
        <span className="text-xl">⚠</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text)]">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
          We couldn't load this page. This might be a temporary connectivity issue
          with our database or blockchain services.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          Back to dashboard
        </a>
      </div>
      {error.digest && (
        <p className="text-xs font-mono text-[var(--text-muted)]">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
