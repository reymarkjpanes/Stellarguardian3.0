/**
 * Breadcrumbs — navigation utility for nested pages.
 *
 * Renders a horizontal trail: Home > Events > [Event Name] > Sub-page
 * Uses semantic nav + ol for accessibility. Screen readers announce
 * "breadcrumb navigation" via aria-label.
 *
 * Design: Small text, chevron separators, muted until hover.
 * Current (last) item is not linked and uses stronger text color.
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-[var(--text-muted)] select-none" aria-hidden="true">
                  /
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  className="text-[var(--text-secondary)] font-medium truncate max-w-[200px]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="hover:text-[var(--text)] transition-colors truncate max-w-[200px]"
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
