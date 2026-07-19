/**
 * Global 404 page.
 * Next.js renders this whenever notFound() is called or a route doesn't exist.
 *
 * Design: On a financial platform, errors should feel controlled — not broken.
 * Large "404" as a subtle background element, clear message, two recovery paths.
 * System font, CSS variables, no external dependencies.
 */
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found | Stellar Guardian",
};

export default function NotFoundPage() {
  return (
    <main
      id="main-content"
      className="min-h-[80vh] flex items-center justify-center px-4"
    >
      <div className="relative text-center max-w-md">
        {/* Ghost 404 — large, faint, behind content */}
        <p
          className="absolute inset-0 flex items-center justify-center text-[11rem] font-black leading-none select-none pointer-events-none"
          style={{ color: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
          aria-hidden="true"
        >
          404
        </p>

        {/* Actual content */}
        <div className="relative z-10 space-y-4 pt-12">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Page not found
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href="/"
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors"
            >
              Back to home
            </a>
            <a
              href="/discover"
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Browse events
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
