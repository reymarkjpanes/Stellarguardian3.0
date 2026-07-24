"use client";

/**
 * Signup page (Req 3.1, 3.2).
 *
 * Registration form with email/password + display name.
 * Uses Supabase Auth signUp with email confirmation.
 * Stores display_name in user_metadata during registration.
 *
 * Design: Matches login page structure — centered card, CSS variables,
 * system font, single accent, no decoration. Dark mode via vars.
 */
import { useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

type FlowStep = "form" | "success";

export default function SignupPage() {
  const [step, setStep] = useState<FlowStep>("form");
  const [displayName, setDisplayName] = useState("");
  const [_captchaToken, setCaptchaToken] = useState<string | null>(null);
  const onCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(null), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!termsAccepted) {
      setError("You must accept the Terms of Service to continue.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setStep("success");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-[var(--success-bg)] flex items-center justify-center">
            <span className="text-lg text-[var(--success)]">✓</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
              Check your email
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              We sent a confirmation link to <strong className="text-[var(--text)]">{email}</strong>
              . Click the link to activate your account.
            </p>
          </div>
          <div className="pt-4 space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              Didn&apos;t receive it? Check your spam folder or try again.
            </p>
            <a
              href="/login"
              className="inline-block text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Back to sign in
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Create your account
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Join Stellar Guardian to host or participate in events
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
              htmlFor="display-name"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              required
              minLength={2}
              maxLength={50}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Jane Smith"
            />
          </div>

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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Min 8 characters"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Re-enter password"
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
            />
            <label htmlFor="terms" className="text-xs text-[var(--text-muted)] leading-relaxed">
              I agree to the{" "}
              <a
                href="/terms"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
            </label>
          </div>

          <TurnstileWidget onVerify={onCaptchaVerify} onExpire={onCaptchaExpire} />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)]">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-[var(--accent)] hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
