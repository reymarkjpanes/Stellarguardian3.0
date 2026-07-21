"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <div className="h-12 w-12 rounded-full bg-[var(--error-bg)] flex items-center justify-center text-xl text-[var(--error)]">
        ✕
      </div>
      <h2 className="text-lg font-semibold text-[var(--text)]">Something went wrong</h2>
      <p className="text-sm text-[var(--text-muted)] max-w-sm">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
