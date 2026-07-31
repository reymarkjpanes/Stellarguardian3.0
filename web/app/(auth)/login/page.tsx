"use client";

/**
 * Login page (Req 3.1, 3.2).
 *
 * Email/password login via the Supabase browser client with automatic
 * token refresh handled by @supabase/ssr cookie persistence.
 */
import { useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setCaptchaToken] = useState<string | null>(null);
  const onCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // Check if user has a workspace
      const { data: workspaces } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .limit(1);

      if (workspaces && workspaces.length > 0) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/onboarding";
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Welcome back</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Sign in to your Stellar Guardian account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--text-secondary)]"
              >
                Password
              </label>
              <a
                href="/forgot-password"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="••••••••"
            />
          </div>

          <TurnstileWidget onVerify={onCaptchaVerify} onExpire={onCaptchaExpire} />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)]">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-medium text-[var(--accent)] hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
