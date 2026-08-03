"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OnboardingFormProps {
  initialDisplayName?: string;
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[@.]/g, "-")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).substring(2, 6);
  return base ? `${base}-${suffix}` : `workspace-${suffix}`;
}

export function OnboardingForm({ initialDisplayName = "" }: OnboardingFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [workspaceName, setWorkspaceName] = useState(
    initialDisplayName ? `${initialDisplayName}'s Workspace` : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = displayName.trim();
    const trimmedWorkspace = workspaceName.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }

    if (!trimmedWorkspace || trimmedWorkspace.length < 2) {
      setError("Workspace name must be at least 2 characters.");
      return;
    }

    setSubmitting(true);

    try {
      // Step a: Call PATCH /api/users/me with { display_name: displayName }
      const patchRes = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmedName }),
      });

      if (!patchRes.ok) {
        const patchJson = await patchRes.json().catch(() => ({}));
        throw new Error(
          patchJson.error?.message || "Failed to update display name. Please try again.",
        );
      }

      // Step b: Call POST /api/workspaces with { name: workspaceName, slug: ... }
      const slug = slugify(trimmedWorkspace);
      const postWsRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedWorkspace,
          slug,
        }),
      });

      if (!postWsRes.ok) {
        const postWsJson = await postWsRes.json().catch(() => ({}));
        throw new Error(
          postWsJson.error?.message || "Failed to create workspace. Please try again.",
        );
      }

      // Step c: On success, router.push("/dashboard")
      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during onboarding.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-md p-8 card space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-[var(--accent)] rounded-xl flex items-center justify-center mb-4">
            <div
              className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin"
              style={{ animationDuration: "3s" }}
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Welcome to Stellar Guardian
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Let&apos;s get your account set up. You can always change these details later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <div
              id="onboarding-error"
              role="alert"
              className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Your Name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (!workspaceName || workspaceName.endsWith("'s Workspace")) {
                  setWorkspaceName(e.target.value ? `${e.target.value}'s Workspace` : "");
                }
              }}
              aria-describedby={error ? "onboarding-error" : undefined}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Alice Organizer"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="workspaceName"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Workspace Name <span className="text-[var(--error)]">*</span>
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              Workspaces organize your hackathons, members, and billing.
            </p>
            <input
              id="workspaceName"
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              aria-describedby={error ? "onboarding-error" : undefined}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="e.g. Acme Corp Hackathons"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-6 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] focus:outline-none disabled:opacity-50 transition-colors"
          >
            {submitting ? "Setting up..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </main>
  );
}
