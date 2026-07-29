"use client";

/**
 * Workspace ID-based fallback page — /workspaces/id/[uuid]
 *
 * Handles workspaces created before slug generation was enforced (empty slug).
 * Checks if a slug exists and redirects; otherwise lets the owner assign one inline.
 */
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

interface WorkspaceData {
  id: string;
  name: string;
  slug: string | null;
  currentUserRole: string;
}

export default function WorkspaceByIdPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/workspaces/id/${id}`);
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const { data } = await res.json();

      // Has a valid slug — redirect to canonical URL immediately
      if (data.slug && data.slug.length >= 2) {
        router.replace(`/workspaces/${data.slug}`);
        return;
      }

      setWorkspace(data);
      setLoading(false);
    }
    load();
  }, [id, router]);

  const derivedSlug = slugTouched ? slug : workspace ? slugify(workspace.name) : "";

  async function handleAssignSlug(e: React.FormEvent) {
    e.preventDefault();
    const finalSlug = derivedSlug.trim();
    if (!finalSlug || finalSlug.length < 2) {
      setError("Slug must be at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(finalSlug)) {
      setError("Lowercase letters, numbers, and hyphens only.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch(`/api/workspaces/id/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: finalSlug }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to save slug.");
      setSaving(false);
      return;
    }

    // Redirect to the new canonical URL
    router.replace(`/workspaces/${finalSlug}`);
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-[var(--bg-muted)] rounded" />
        <div className="h-32 bg-[var(--bg-muted)] rounded-xl" />
      </div>
    );
  }

  if (!workspace) return null;

  const isAdmin = ["Owner", "Admin"].includes(workspace.currentUserRole);

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="card p-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">{workspace.name}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{workspace.currentUserRole}</p>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <p className="text-sm font-medium text-amber-400">URL slug required</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            This workspace needs a URL slug before you can access it. This is a one-time setup.
          </p>
        </div>

        {isAdmin ? (
          <form onSubmit={handleAssignSlug} className="space-y-4">
            <div>
              <label
                htmlFor="ws-slug"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Choose a URL slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">/workspaces/</span>
                <input
                  id="ws-slug"
                  type="text"
                  required
                  minLength={2}
                  maxLength={40}
                  value={derivedSlug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                    setError(null);
                  }}
                  placeholder="my-workspace"
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Lowercase letters, numbers, and hyphens. Cannot be changed later.
              </p>
            </div>

            {error && (
              <p className="text-sm text-[var(--error)]">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save & Continue"}
              </button>
              <a
                href="/dashboard"
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                Back
              </a>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Ask a workspace Owner or Admin to set the URL slug.
            </p>
            <a
              href="/dashboard"
              className="inline-block rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
