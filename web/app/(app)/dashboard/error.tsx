"use client";

import { ErrorState } from "@/components/ui/loading-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <ErrorState
        message={error.message || "Failed to load dashboard."}
        retry={reset}
      />
    </div>
  );
}
