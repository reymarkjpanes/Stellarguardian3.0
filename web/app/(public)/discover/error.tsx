"use client";

import { ErrorState } from "@/components/ui/loading-state";

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <ErrorState
        message={error.message || "Failed to load events."}
        retry={reset}
      />
    </div>
  );
}
