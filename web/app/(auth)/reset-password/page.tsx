"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // M5: validate passwords match before hitting the server
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage("Password updated successfully. Redirecting to sign in…");

      // Redirect to login after a brief pause
      setTimeout(() => {
        router.push("/login");
      }, 2000);
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
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Set new password
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Please enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              id="reset-error"
              role="alert"
              className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
            >
              {error}
            </div>
          )}
          {message && (
            <div
              role="alert"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent)]"
            >
              {message}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? "reset-error" : undefined}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="At least 8 characters"
            />
          </div>

          {/* M5: confirm password field */}
          <div className="space-y-2">
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-describedby={error ? "reset-error" : undefined}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Re-enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 transition-colors"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
