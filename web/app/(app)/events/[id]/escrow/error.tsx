"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function EscrowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Escrow Page Error:", error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
      <div className="rounded-full bg-[var(--error-bg)] p-3 text-[var(--error)]">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-[var(--text)]">Failed to load Escrow dashboard</h2>
      <p className="max-w-md text-center text-[var(--text-muted)]">
        {error.message || "We encountered an error loading the escrow details. Please try again."}
      </p>
      <div className="flex gap-4 mt-4">
        <button onClick={() => reset()} className="btn-primary px-4 py-2 text-sm">
          Try again
        </button>
        <Link href="/dashboard" className="btn-secondary px-4 py-2 text-sm">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
