"use client";

/**
 * global-error.tsx
 *
 * Required by Next.js App Router / Turbopack to satisfy the React Client
 * Manifest. This catches errors thrown in the root layout that cannot be
 * handled by a nested error.tsx boundary.
 *
 * Must be a Client Component and must render <html>/<body> because it
 * replaces the root layout when active.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "400px",
            padding: "2rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#a1a1aa",
              marginBottom: "1.5rem",
            }}
          >
            {error.digest ? `Error ID: ${error.digest}` : "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              background: "#ffffff",
              color: "#0a0a0a",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
