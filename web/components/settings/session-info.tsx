/**
 * Session Info — displays current session details (L8).
 *
 * Shows when the session was created, last activity, and provides
 * a sign-out-all-devices button.
 */
"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function SessionInfo() {
  const [loading, setLoading] = useState(false);

  async function handleSignOutAll() {
    if (!confirm("Sign out from all devices? You will need to log in again.")) return;
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/login";
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
      <button
        onClick={handleSignOutAll}
        disabled={loading}
        className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-50"
      >
        {loading ? "Signing out…" : "Sign out all devices"}
      </button>
    </div>
  );
}
