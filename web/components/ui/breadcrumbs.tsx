/**
 * Breadcrumb navigation component.
 */

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          {idx > 0 && <span aria-hidden="true">›</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-[var(--text)] transition-colors">
              {item.label}
            </a>
          ) : (
            <span className="text-[var(--text)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
