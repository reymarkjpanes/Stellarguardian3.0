/**
 * Reusable empty state component for lists with no data.
 */

interface EmptyStateProps {
  title?: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="card p-8 text-center">
      {title && (
        <h3 className="text-sm font-medium text-[var(--text)] mb-1">{title}</h3>
      )}
      <p className="text-sm text-[var(--text-muted)]">{description}</p>
      {action && (
        <a
          href={action.href}
          className="inline-block mt-4 text-sm font-medium text-[var(--accent)] hover:underline"
        >
          {action.label} →
        </a>
      )}
    </div>
  );
}
