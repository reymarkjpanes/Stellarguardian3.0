import { useState, useEffect, useCallback } from "react";

interface Invitation {
  id: string;
  invitee_email: string;
  accepted_at: string | null;
}

interface InviteDrawerProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function InviteDrawer({ eventId, isOpen, onClose, onRefresh }: InviteDrawerProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  const loadInvitations = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invitations`);
      if (res.ok) {
        const json = (await res.json()) as { data?: Invitation[] };
        setInvitations(json.data ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvites(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadInvitations();
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset form state when drawer closes — use key pattern on the form instead of effect setState
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/events/${eventId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeEmail: email }),
      });
      if (res.ok) {
        setSuccess(true);
        setEmail("");
        void loadInvitations();
        onRefresh();
      } else {
        const err = (await res.json()) as { error?: { message?: string } };
        setError(err.error?.message ?? "Failed to invite user");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelInvite(invitationId: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        void loadInvitations();
      }
    } catch {
      // silent — non-critical
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-[var(--bg)] shadow-2xl transition-transform duration-300 translate-x-0 border-l border-[var(--border)] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-medium text-lg">Manage Invitations</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-md hover:bg-[var(--bg-muted)] text-[var(--text-muted)] transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex-1 space-y-8">
          {/* key resets controlled inputs when drawer re-opens */}
          <form key={isOpen ? "open" : "closed"} onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                Invite by Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            {success && <p className="text-sm text-green-600">Invitation sent successfully!</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Invitation"}
            </button>
          </form>

          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="font-medium mb-4">Pending Invitations</h3>
            {loadingInvites ? (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] italic">No pending invitations.</p>
            ) : (
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]"
                  >
                    <div>
                      <p className="text-sm font-medium">{inv.invitee_email}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {inv.accepted_at ? "Accepted" : "Pending"}
                      </p>
                    </div>
                    {!inv.accepted_at && (
                      <button
                        onClick={() => void handleCancelInvite(inv.id)}
                        className="text-xs font-medium text-[var(--error)] hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
