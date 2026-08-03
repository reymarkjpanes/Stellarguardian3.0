"use client";

/**
 * Workspace creation page.
 *
 * Simple single-step form — workspaces are lightweight containers.
 * Fields: name (required), slug (auto-generated, editable), description (optional).
 * After creation: redirect to workspace events view.
 *
 * Design: card form matching the platform's established patterns.
 * CSS variables throughout. System font. Single accent.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[@.]/g, "-") // treat @ and . as word separators
    .replace(/[^\w\s-]/g, "") // strip remaining special chars
    .replace(/[\s_]+/g, "-") // spaces/underscores → hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, "") // trim leading/trailing hyphens
    .slice(0, 40);
}

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Derive slug from name when user hasn't manually edited it
  const derivedSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Always use the derived slug (accounts for auto-generated case)
    const finalSlug = derivedSlug.trim();

    if (!name.trim() || name.trim().length < 2) {
      setError("Workspace name must be at least 2 characters.");
      return;
    }
    if (!finalSlug || finalSlug.length < 2) {
      setError("Slug must be at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(finalSlug)) {
      setError("Slug must be lowercase letters, numbers, and hyphens only.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: finalSlug,
          description: description.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error?.code === "CONFLICT") {
          setError("A workspace with this slug already exists. Choose a different name.");
        } else {
          setError(json.error?.message || "Failed to create workspace.");
        }
        setSubmitting(false);
        return;
      }

      // Redirect to the new workspace page via SPA navigation
      router.push(`/workspaces/${json.data.slug}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const labelCls = "block text-sm font-medium text-[var(--text-secondary)] mb-1";

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Create a workspace
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Workspaces organize your events and team under one roof.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {error && (
            <div
              id="ws-new-error"
              role="alert"
              className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="ws-name" className={labelCls}>
              Workspace name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="ws-name"
              type="text"
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={error ? "ws-new-error" : undefined}
              aria-invalid={error ? true : undefined}
              className={inputCls}
              placeholder="Stellar Hackathon Team"
            />
          </div>

          <div>
            <label htmlFor="ws-slug" className={labelCls}>
              URL slug <span className="text-[var(--error)]">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">/workspaces/</span>
              <input
                id="ws-slug"
                type="text"
                required
                minLength={2}
                maxLength={40}
                pattern="[a-z0-9-]+"
                title="Lowercase letters, numbers, and hyphens only"
                value={derivedSlug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                aria-describedby={error ? "ws-new-error" : "ws-slug-hint"}
                aria-invalid={error ? true : undefined}
                className={inputCls}
                placeholder="stellar-hackathon-team"
              />
            </div>
            <p id="ws-slug-hint" className="text-xs text-[var(--text-muted)] mt-1">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <div>
            <label htmlFor="ws-desc" className={labelCls}>
              Description <span className="font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              id="ws-desc"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
              placeholder="What is this workspace for?"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <a
              href="/dashboard"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--btn-primary-bg)] px-5 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {submitting ? "Creating…" : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
