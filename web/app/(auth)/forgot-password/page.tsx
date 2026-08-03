/**
 * Forgot Password page — request a password reset email.
 * Uses Supabase Auth resetPasswordForEmail with redirect to /auth/callback.
 */
"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui/back-button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="h-12 w-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-700 text-lg">✓</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-[var(--text-muted)]">
            If an account exists for <strong>{email}</strong>, we sent a password reset link. Check
            your inbox (and spam folder).
          </p>
          <div className="flex justify-center">
            <BackButton href="/login" label="Back to login" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              aria-describedby={error ? "forgot-error" : undefined}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <p id="forgot-error" className="text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--btn-primary-bg)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--btn-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)]">
          Remember your password?{" "}
          <a href="/login" className="text-[var(--accent)] hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
