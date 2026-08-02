/**
 * Workspace members management page — with invitation send form (C6 fix).
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";

interface Member {
  user_id: string;
  role: string;
  display_name: string;
  email: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export default function WorkspaceMembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManageFromApi, setCanManageFromApi] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Member" | "Admin">("Member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadAll() {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/workspaces/${slug}/members`),
        fetch(`/api/workspaces/${slug}/invitations`),
      ]);

      if (!membersRes.ok) {
        router.push("/dashboard");
        return;
      }

      const { data: membersData, currentUserId } = await membersRes.json();
      const { data: invitationsData } = invitationsRes.ok
        ? await invitationsRes.json()
        : { data: [] };

      if (!ignore) {
        setMembers(membersData ?? []);
        // Only show pending invitations
        setInvitations(
          (invitationsData ?? []).filter((inv: Invitation) => inv.status === "pending"),
        );
        // Check if the current user is Owner or Admin
        const myEntry = (membersData ?? []).find((m: Member) => m.user_id === currentUserId);
        setCanManageFromApi(myEntry?.role === "Owner" || myEntry?.role === "Admin");
        setLoading(false);
      }
    }
    loadAll();
    return () => {
      ignore = true;
    };
  }, [slug, router]);

  // Determine if current user can manage invitations (Owner or Admin)
  const canManage = canManageFromApi;

  async function handleRemove(userId: string) {
    if (!confirm("Remove this member from the workspace?")) return;

    const res = await fetch(`/api/workspaces/${slug}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });

    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    const res = await fetch(`/api/workspaces/${slug}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    const data = await res.json();
    if (!res.ok) {
      setInviteError(data.error?.message ?? "Failed to send invitation.");
    } else {
      setInviteSuccess(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail("");
      setInviteRole("Member");
      // Add to pending list
      if (data.data) {
        setInvitations((prev) => [data.data, ...prev]);
      }
    }
    setInviting(false);
  }

  async function handleRevokeInvitation(invitationId: string, email: string) {
    if (!confirm(`Revoke invitation for ${email}?`)) return;

    const res = await fetch(`/api/workspaces/${slug}/invitations/${invitationId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    }
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--bg-muted)] rounded" />
          <div className="h-16 bg-[var(--bg-muted)] rounded" />
          <div className="h-16 bg-[var(--bg-muted)] rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage workspace membership</p>
        </div>
        <BackButton href={`/workspaces/${slug}`} label="Back to Workspace" />
      </div>

      {/* Member list */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">
          Current Members
        </h2>
        {members.map((member) => (
          <div key={member.user_id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)]">
                {member.display_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{member.display_name}</p>
                <p className="text-xs text-[var(--text-muted)]">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                {member.role}
              </span>
              {member.role !== "Owner" && canManage && (
                <button
                  onClick={() => handleRemove(member.user_id)}
                  className="text-xs text-[var(--error)] hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">No members found.</p>
        )}
      </section>

      {/* Invite Member form — only for Owner/Admin */}
      {canManage && (
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">Invite Member</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Send an invitation link to a new team member via email.
          </p>

          <form onSubmit={handleInvite} className="space-y-4">
            {inviteError && (
              <div
                role="alert"
                className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
              >
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div
                role="alert"
                className="rounded-md border border-[var(--accent)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent)]"
              >
                {inviteSuccess}
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label
                  htmlFor="invite-email"
                  className="block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Email Address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
              <div className="w-32 space-y-1">
                <label
                  htmlFor="invite-role"
                  className="block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "Member" | "Admin")}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={inviting}
              className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {inviting ? "Sending…" : "Send Invitation"}
            </button>
          </form>
        </section>
      )}

      {/* Pending invitations */}
      {canManage && invitations.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            Pending Invitations
          </h2>
          {invitations.map((inv) => (
            <div key={inv.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{inv.email}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {inv.role} · Invited {new Date(inv.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[var(--warning-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--warning)]">
                  Pending
                </span>
                <button
                  onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                  className="text-xs text-[var(--error)] hover:underline"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
