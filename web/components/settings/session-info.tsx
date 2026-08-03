/**
 * Session Info — displays current session details and sign-out-all-devices.
 * Uses inline confirm instead of window.confirm (L8).
 */
"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function SessionInfo() {
  const [loading, setLoading] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function handleSignOutAll() {
    setConfirmSignOut(false);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/login"; // intentional full-page reload to clear all state
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text)]">Current session</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">This device · Active now</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-green-400" />
      </div>

      {!confirmSignOut ? (
        <button
          onClick={() => setConfirmSignOut(true)}
          disabled={loading}
          className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-50"
        >
          {loading ? "Signing out…" : "Sign out all devices"}
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-label="Confirm sign out all devices"
          className="rounded-md border border-[var(--error)]/40 bg-[var(--error-bg)] px-3 py-2 space-y-2"
        >
          <p className="text-xs text-[var(--error)]">
            Sign out from all devices? You will need to log in again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleSignOutAll}
              disabled={loading}
              className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-50"
            >
              Sign out all
            </button>
            <button
              onClick={() => setConfirmSignOut(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
