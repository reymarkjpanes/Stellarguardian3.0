"use client";

/**
 * Signup page — email/password registration.
 *
 * Includes:
 * - M1: emailRedirectTo → /auth/callback?next=/onboarding (auto-login after confirmation)
 * - M2: inline password strength indicator
 * - M3: Terms of Service acceptance checkbox (required before submit)
 * - C9: button locked after success to prevent double-submit
 */
import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";

// ─── Password strength ────────────────────────────────────────────────────────

type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

function getStrength(pw: string): StrengthLevel {
  if (!pw) return "empty";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

const STRENGTH_META: Record<
  Exclude<StrengthLevel, "empty">,
  { label: string; color: string; bars: number }
> = {
  weak: { label: "Weak", color: "bg-[var(--error)]", bars: 1 },
  fair: { label: "Fair", color: "bg-[var(--warning,#f59e0b)]", bars: 2 },
  good: { label: "Good", color: "bg-[var(--accent)]", bars: 3 },
  strong: { label: "Strong", color: "bg-[var(--success,#22c55e)]", bars: 4 },
};

function PasswordStrength({ password }: { password: string }) {
  const level = getStrength(password);
  if (level === "empty") return null;
  const meta = STRENGTH_META[level];
  return (
    <div className="space-y-1" aria-live="polite" aria-atomic="true">
      <div className="flex gap-1" role="img" aria-label={`Password strength: ${meta.label}`}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= meta.bars ? meta.color : "bg-[var(--bg-muted)]"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Strength: <span className="font-medium text-[var(--text)]">{meta.label}</span>
        {level === "weak" && " — add uppercase letters, numbers, or symbols"}
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Client-side guards before hitting the network
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!termsAccepted) {
      setError("You must accept the Terms of Service to create an account.");
      return;
    }

    setLoading(true);
    let succeeded = false;

    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          // M1: auto-login after email confirmation via PKCE callback
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      succeeded = true;
      setMessage(
        "Check your email for the confirmation link. Once confirmed you'll be signed in automatically.",
      );
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      // C9: keep button disabled after success to prevent double-submit
      if (!succeeded) setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Create an account
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Join Stellar Guardian to organize and participate in events.
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
          {message && (
            <div
              role="status"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent)]"
            >
              {message}
            </div>
          )}

          {/* Display name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              Display Name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="Your Name"
              aria-describedby="name-hint"
            />
            <p id="name-hint" className="text-xs text-[var(--text-muted)]">
              This is how you appear to other users.
            </p>
          </div>

          {/* Email */}
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
              className={inputCls}
              placeholder="you@example.com"
            />
          </div>

          {/* Password + strength indicator */}
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
              className={inputCls}
              placeholder="At least 8 characters"
              aria-describedby="password-strength"
            />
            <div id="password-strength">
              <PasswordStrength password={password} />
            </div>
          </div>

          {/* M3: Terms of Service checkbox */}
          <div className="flex items-start gap-3">
            <input
              id="terms"
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
            />
            <label
              htmlFor="terms"
              className="text-xs text-[var(--text-secondary)] cursor-pointer leading-relaxed"
            >
              I agree to the{" "}
              <Link href="/terms" className="text-[var(--accent)] hover:underline" target="_blank">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
              >
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing up…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
