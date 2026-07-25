/**
 * Invitation acceptance page with trust context.
 *
 * Route: /invitations/accept?token=<uuid>
 * Before processing the invitation, shows the participant key event details
 * and trust signals so they can make an informed decision to join.
 *
 * Flow:
 *   1. Load invitation preview (event name, role, organizer info)
 *   2. Show trust signals — escrow status, judges assigned, etc.
 *   3. User clicks "Accept & Join" — triggers the API call
 *   4. Success / error state
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EventTrustSignals } from "@/components/events/event-trust-signals";

type PageState = "loading" | "preview" | "accepting" | "success" | "error" | "expired" | "invalid";

interface InvitePreview {
  workspace_name: string;
  workspace_id: string;
  role: string;
  invited_by: string;
  email: string;
  // Event context — fetched if event_id is attached
  event?: {
    id: string;
    title: string;
    description: string;
    state: string;
    prize_pool_target: number | null;
    network_mode: "testnet" | "mainnet";
    review_window_hours: number;
  } | null;
  judge_count?: number;
  organizer_verified?: boolean;
}

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>(() => (token ? "loading" : "invalid"));
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [message, setMessage] = useState(() => (token ? "" : "No invitation token provided."));
  const [workspaceName, setWorkspaceName] = useState("");

  const loadPreview = useCallback(async (inviteToken: string) => {
    try {
      // Fetch invitation details first — show trust context before auto-accepting
      const res = await fetch(`/api/invitations/preview?token=${encodeURIComponent(inviteToken)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error?.message ?? "Invalid invitation.";
        if (msg.includes("expired")) setPageState("expired");
        else setPageState("invalid");
        setMessage(msg);
        return;
      }
      const { data } = await res.json();
      setPreview(data);
      setPageState("preview");
    } catch {
      setPageState("error");
      setMessage("Network error. Please try again.");
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadPreview(token);
    }
  }, [token, loadPreview]);

  async function handleAccept() {
    if (!token) return;
    setPageState("accepting");
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setWorkspaceName(data.data?.workspace_name ?? preview?.workspace_name ?? "the workspace");
        setPageState("success");
      } else {
        const msg = data.error?.message ?? "Failed to accept.";
        if (msg.includes("expired")) setPageState("expired");
        else setPageState("error");
        setMessage(msg);
      }
    } catch {
      setPageState("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-16">
      {/* Loading */}
      {pageState === "loading" && (
        <div className="text-center space-y-6">
          <div className="h-12 w-12 mx-auto rounded-full bg-[var(--bg-muted)] animate-pulse" />
          <p className="text-sm text-[var(--text-muted)]">Loading invitation…</p>
        </div>
      )}

      {/* Preview with trust signals */}
      {(pageState === "preview" || pageState === "accepting") && preview && (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="h-12 w-12 mx-auto rounded-full bg-[var(--accent-muted)] flex items-center justify-center text-[var(--accent)] text-xl">
              ✉
            </div>
            <h1 className="text-xl font-semibold text-[var(--text)]">You&apos;re invited</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Join <strong>{preview.workspace_name}</strong> as a <strong>{preview.role}</strong>.
            </p>
          </div>

          {/* Event context — only shown if invitation is tied to an event */}
          {preview.event && (
            <div className="card p-5 space-y-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                  Event
                </p>
                <h2 className="text-base font-semibold text-[var(--text)] mt-0.5">
                  {preview.event.title}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-3">
                  {preview.event.description}
                </p>
              </div>

              {/* Trust signals — helps participant decide before accepting */}
              <EventTrustSignals
                eventId={preview.event.id}
                eventState={preview.event.state}
                prizePoolTarget={preview.event.prize_pool_target}
                judgeCount={preview.judge_count ?? 0}
                hasVerifiedOrganizer={preview.organizer_verified ?? false}
                reviewWindowHours={preview.event.review_window_hours}
                networkMode={preview.event.network_mode}
              />
            </div>
          )}

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={pageState === "accepting"}
              className="w-full btn-primary py-2.5 text-sm font-medium rounded-md disabled:opacity-50"
            >
              {pageState === "accepting" ? "Accepting…" : "Accept & Join"}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)]">
              By accepting, you&apos;ll be added to <strong>{preview.workspace_name}</strong> as a{" "}
              {preview.role}.
            </p>
          </div>
        </div>
      )}

      {/* Success */}
      {pageState === "success" && (
        <div className="text-center space-y-6">
          <div className="h-12 w-12 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <span className="text-green-700 dark:text-green-300 text-lg">✓</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[var(--text)]">You&apos;re in!</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              You&apos;ve been added to <strong>{workspaceName}</strong>.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-primary px-5 py-2.5 text-sm font-medium rounded-md"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {/* Expired */}
      {pageState === "expired" && (
        <div className="text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-300 text-xl">
            ⏰
          </div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Invitation expired</h1>
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
          <p className="text-xs text-[var(--text-muted)]">
            Ask the workspace owner to send a new invitation.
          </p>
        </div>
      )}

      {/* Error / Invalid */}
      {(pageState === "error" || pageState === "invalid") && (
        <div className="text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-700 dark:text-red-300 text-xl">
            ✕
          </div>
          <h1 className="text-xl font-semibold text-[var(--text)]">
            {pageState === "invalid" ? "Invalid link" : "Something went wrong"}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
          <a href="/dashboard" className="text-sm text-[var(--accent)] hover:underline">
            Go to Dashboard
          </a>
        </div>
      )}
    </main>
  );
}
