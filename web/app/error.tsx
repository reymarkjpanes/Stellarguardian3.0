"use client";

/**
 * Global error boundary — catches unhandled errors in Server Components.
 * Shows a user-friendly error message instead of "Internal Server Error".
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto h-14 w-14 rounded-full bg-[var(--error-bg)] flex items-center justify-center">
          <span className="text-2xl">⚠</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            Something went wrong
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            An unexpected error occurred. This may be a temporary issue with our services.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-[var(--text-muted)]">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-[var(--btn-primary-bg)] px-5 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
