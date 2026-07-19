/**
 * Invitation acceptance page.
 *
 * Route: /invitations/accept?token=<uuid>
 * Uses the invitation service to accept and add user to workspace.
 * Requires authentication — middleware will redirect to login if unauthenticated.
 */
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type AcceptState = "loading" | "success" | "error" | "expired" | "invalid";

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<AcceptState>("loading");
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setMessage("No invitation token provided.");
      return;
    }
    acceptInvitation(token);
  }, [token]);

  async function acceptInvitation(inviteToken: string) {
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setState("success");
        setWorkspaceName(data.data?.workspace_name ?? "the workspace");
      } else {
        const errorMsg = data.error?.message ?? "Failed to accept invitation.";
        if (errorMsg.includes("expired")) {
          setState("expired");
        } else {
          setState("error");
        }
        setMessage(errorMsg);
      }
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-24">
      <div className="text-center space-y-6">
        {state === "loading" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-[var(--bg-muted)] animate-pulse" />
            <h1 className="text-xl font-semibold text-[var(--text)]">Accepting invitation…</h1>
            <p className="text-sm text-[var(--text-muted)]">Please wait while we process your invitation.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-green-700 dark:text-green-300 text-lg">✓</span>
            </div>
            <h1 className="text-xl font-semibold text-[var(--text)]">You&apos;re in!</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              You&apos;ve been added to <strong>{workspaceName}</strong>.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-primary px-5 py-2.5 text-sm font-medium rounded-md"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {state === "expired" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="text-amber-700 dark:text-amber-300 text-lg">⏰</span>
            </div>
            <h1 className="text-xl font-semibold text-[var(--text)]">Invitation expired</h1>
            <p className="text-sm text-[var(--text-secondary)]">{message}</p>
            <p className="text-xs text-[var(--text-muted)]">
              Ask the workspace owner to send a new invitation.
            </p>
          </>
        )}

        {(state === "error" || state === "invalid") && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <span className="text-red-700 dark:text-red-300 text-lg">✕</span>
            </div>
            <h1 className="text-xl font-semibold text-[var(--text)]">
              {state === "invalid" ? "Invalid link" : "Something went wrong"}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">{message}</p>
            <a href="/dashboard" className="text-sm text-[var(--accent)] hover:underline">
              Go to Dashboard
            </a>
          </>
        )}
      </div>
    </main>
  );
}
