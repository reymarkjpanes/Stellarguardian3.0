/**
 * Onboarding page — shown to new users after signup.
 * Guides through: name setup → wallet connection → first workspace.
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

type Step = "profile" | "wallet" | "workspace" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkProfile() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("users")
        .select("display_name, terms_accepted_version")
        .eq("id", user.id)
        .single();

      if (profile?.display_name && profile.display_name !== user.email) {
        setStep("wallet");
      }
    }
    checkProfile();
  }, [router]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        terms_accepted_version: "1.0",
      }),
    });

    if (!res.ok) {
      const { error: err } = await res.json();
      setError(err?.message ?? "Failed to save.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setStep("wallet");
  }

  function skipWallet() {
    setStep("workspace");
  }

  function finishOnboarding() {
    router.push("/dashboard");
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-16 space-y-8">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {(["profile", "wallet", "workspace"] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${
              step === s ? "bg-[var(--accent)]" :
              (["profile", "wallet", "workspace"].indexOf(step) > idx) ? "bg-green-400" :
              "bg-[var(--bg-muted)]"
            }`} />
            {idx < 2 && <div className="w-8 h-px bg-[var(--border)]" />}
          </div>
        ))}
      </div>

      {/* Step: Profile */}
      {step === "profile" && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to Stellar Guardian</h1>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              Let's set up your profile to get started.
            </p>
          </div>
          <form onSubmit={handleProfileSave} className="card p-6 space-y-4">
            <div>
              <label htmlFor="onb-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Display Name
              </label>
              <input
                id="onb-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should others see you?"
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-[var(--accent)] hover:underline">Terms of Service</a>{" "}
              and <a href="/privacy" className="text-[var(--accent)] hover:underline">Privacy Policy</a>.
            </div>
            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full py-2.5 text-sm font-medium rounded-md disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          </form>
        </div>
      )}

      {/* Step: Wallet */}
      {step === "wallet" && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Connect Your Wallet</h1>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              Connect a Stellar wallet to fund events and receive prizes.
            </p>
          </div>
          <div className="card p-6 space-y-4 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              You can connect your Freighter wallet now, or do it later from Settings.
            </p>
            <div className="flex gap-3 justify-center">
              <a
                href="/settings"
                className="btn-primary px-5 py-2 text-sm font-medium rounded-md"
              >
                Connect Wallet
              </a>
              <button
                onClick={skipWallet}
                className="rounded-md border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)]"
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Workspace */}
      {step === "workspace" && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">You're All Set!</h1>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              Create a workspace to organize events, or browse existing ones.
            </p>
          </div>
          <div className="card p-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="/workspaces/new"
                className="card p-4 text-center hover:border-[var(--accent)] transition-colors"
              >
                <p className="font-medium text-[var(--text)]">Create Workspace</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Organize your own events</p>
              </a>
              <a
                href="/discover"
                className="card p-4 text-center hover:border-[var(--accent)] transition-colors"
              >
                <p className="font-medium text-[var(--text)]">Discover Events</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Join as a participant</p>
              </a>
            </div>
            <button
              onClick={finishOnboarding}
              className="w-full text-center text-sm font-medium text-[var(--accent)] hover:underline mt-4"
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
