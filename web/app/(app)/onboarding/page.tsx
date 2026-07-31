"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const _router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workspaceName, setWorkspaceName] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const supabase = createBrowserClient();

    async function checkState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      // Pre-fill fields based on metadata if available
      setDisplayName(user.user_metadata?.full_name || "");
      setWorkspaceName(
        user.user_metadata?.full_name ? `${user.user_metadata.full_name}'s Workspace` : "",
      );

      // Check if user already has a workspace
      const { data: workspaces } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1);

      if (workspaces && workspaces.length > 0) {
        // User already has a workspace, skip onboarding
        window.location.href = "/dashboard";
      } else {
        setLoading(false);
      }
    }

    checkState();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createBrowserClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update user display name if it changed
      if (displayName !== user.user_metadata?.full_name) {
        await supabase.auth.updateUser({
          data: { full_name: displayName },
        });
      }

      // Create the default workspace using the CreateWorkspaceAction (if available) or RPC
      // Since we don't have a direct server action handy, we'll try to insert directly
      // Wait, let's use the standard `workspaces` table insertion (needs RLS to allow it)
      // Usually creating a workspace involves creating the workspace and then the member link.
      // We'll call the `create_workspace` RPC if it exists, or insert directly.

      const slug =
        workspaceName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Math.random().toString(36).substring(2, 6);

      // Attempt manual insertion
      const { error: wsError } = await supabase
        .from("workspaces")
        .insert({
          slug,
          name: workspaceName,
          description: "My personal workspace",
        })
        .select("id")
        .single();

      if (wsError) throw new Error("Failed to create workspace: " + wsError.message);

      // We don't need to manually insert into workspace_members if there's a trigger,
      // but let's insert it explicitly just in case (assuming RLS allows it or RPC handles it).
      // Wait, there is a trigger `tr_workspaces_insert` that automatically adds the creator as Owner!
      // Let's rely on the trigger.

      // We are done! Redirect to dashboard
      window.location.href = "/dashboard";
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "An error occurred during onboarding.");
      } else {
        setError("An error occurred during onboarding.");
      }
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-6 h-6 border-2 border-[var(--accent)] rounded-full border-t-transparent animate-spin" />
      </main>
    );
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
            <div className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Your Name
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Alice Organizer"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="workspaceName"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Workspace Name
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              Workspaces organize your hackathons, members, and billing.
            </p>
            <input
              id="workspaceName"
              type="text"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
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
