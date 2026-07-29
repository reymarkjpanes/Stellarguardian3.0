"use client";

import { ErrorState } from "@/components/ui/loading-state";

export default function CreateEventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <ErrorState
        message={error.message || "Failed to load the event creation form."}
        retry={reset}
      />
    </div>
  );
}
