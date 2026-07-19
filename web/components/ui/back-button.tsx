"use client";

/**
 * Reusable BackButton component (Req 2.4, 18.2).
 *
 * Supports:
 * - Direct URL routing via `href` (Next.js Link)
 * - Browser history navigation via `router.back()` (when `href` is omitted)
 * - Custom labels, icons, variants (ghost, outline, subtle), and custom click handlers
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export interface BackButtonProps {
  /**
   * Target URL. If provided, navigates directly to this route.
   * If omitted, calls browser back (router.back()).
   */
  href?: string;
  /**
   * Button label. Defaults to "Back".
   */
  label?: ReactNode;
  /**
   * Visual styling variant.
   * - `ghost`: Minimalist text link with icon (default)
   * - `outline`: Bordered button
   * - `subtle`: Muted background pill
   */
  variant?: "ghost" | "outline" | "subtle";
  /**
   * Additional CSS class names.
   */
  className?: string;
  /**
   * Optional click handler called before navigation.
   */
  onClick?: () => void;
}

export function BackButton({
  href,
  label = "Back",
  variant = "ghost",
  className = "",
  onClick,
}: BackButtonProps) {
  const router = useRouter();

  const variantStyles = {
    ghost:
      "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] px-2.5 py-1.5 rounded-md",
    outline:
      "border border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] px-3 py-1.5 rounded-md shadow-xs",
    subtle:
      "bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:text-[var(--text)] px-3 py-1.5 rounded-full",
  };

  const baseStyles =
    "group inline-flex items-center gap-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer select-none";

  const content = (
    <>
      <svg
        className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
        />
      </svg>
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        router.back();
      }}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      aria-label={typeof label === "string" ? label : "Go back"}
    >
      {content}
    </button>
  );
}
