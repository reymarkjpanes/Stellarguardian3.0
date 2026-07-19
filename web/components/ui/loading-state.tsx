/**
 * Loading, empty, and error state components (Req 22.2).
 * Includes aria-live announcements for accessibility.
 */

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div aria-live="polite" aria-busy="true" className="py-12 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      <p className="mt-3 text-sm text-neutral-500">{message}</p>
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div aria-live="polite" className="py-16 text-center">
      <h3 className="text-lg font-medium text-neutral-700">{title}</h3>
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      {action && (
        <a
          href={action.href}
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-red-200 bg-red-50 px-6 py-8 text-center"
    >
      <p className="text-sm text-red-700">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-3 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
        >
          Try again
        </button>
      )}
    </div>
  );
}
