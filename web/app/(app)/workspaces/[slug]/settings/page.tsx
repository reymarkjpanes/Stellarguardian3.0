/**
 * Workspace settings page — name, description, billing, danger zone.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  billing: { plan?: string };
  version: number;
  currentUserRole: string;
}

export default function WorkspaceSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/workspaces/${slug}`);
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const { data } = await res.json();
      setWorkspace(data);
      setName(data.name);
      setDescription(data.description ?? "");
      setLoading(false);
    }
    load();
  }, [slug, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch(`/api/workspaces/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Failed to update.");
    } else {
      setSuccess(true);
      const { data } = await res.json();
      setWorkspace(data);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--bg-muted)] rounded" />
          <div className="h-4 w-96 bg-[var(--bg-muted)] rounded" />
        </div>
      </main>
    );
  }

  if (!workspace || workspace.currentUserRole === "Member") {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-[var(--text-muted)]">
          You do not have permission to manage this workspace.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage {workspace.name} settings</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset className="card p-6 space-y-4">
          <legend className="text-sm font-medium text-[var(--text)]">General</legend>

          <div>
            <label
              htmlFor="ws-name"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Name
            </label>
            <input
              id="ws-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="ws-desc"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Description
            </label>
            <textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Slug
            </label>
            <p className="text-sm text-[var(--text-muted)]">
              /{workspace.slug} (cannot be changed)
            </p>
          </div>
        </fieldset>

        <fieldset className="card p-6 space-y-3">
          <legend className="text-sm font-medium text-[var(--text)]">Billing</legend>
          <p className="text-sm text-[var(--text-secondary)]">
            Current plan:{" "}
            <span className="font-medium capitalize">{workspace.billing?.plan ?? "free"}</span>
          </p>
          <p className="text-xs text-[var(--text-muted)]">Plan upgrades coming soon.</p>
        </fieldset>

        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        {success && <p className="text-sm text-green-600">Settings saved successfully.</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-5 py-2 text-sm font-medium rounded-md disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <a
            href={`/workspaces/${slug}`}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Cancel
          </a>
        </div>
      </form>

      {workspace.currentUserRole === "Owner" && (
        <fieldset className="card p-6 border-[var(--error)] space-y-3">
          <legend className="text-sm font-medium text-[var(--error)]">Danger Zone</legend>
          <p className="text-sm text-[var(--text-secondary)]">
            Deleting a workspace removes all events and data permanently.
          </p>
          <button
            type="button"
            className="rounded-md border border-[var(--error)] px-4 py-2 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
            onClick={() => { /* Delete workspace flow not yet implemented */ }}
          >
            Delete Workspace
          </button>
        </fieldset>
      )}
    </main>
  );
}
