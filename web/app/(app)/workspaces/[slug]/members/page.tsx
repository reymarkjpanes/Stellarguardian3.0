/**
 * Workspace members management page.
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

export default function WorkspaceMembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadMembers() {
      const res = await fetch(`/api/workspaces/${slug}/members`);
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const { data } = await res.json();
      if (!ignore) {
        setMembers(data);
        setLoading(false);
      }
    }
    loadMembers();
    return () => {
      ignore = true;
    };
  }, [slug, router]);

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
      <div className="space-y-2">
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
              {member.role !== "Owner" && (
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
      </div>

      {/* Invite note */}
      <div className="card p-6">
        <h3 className="text-sm font-medium text-[var(--text)] mb-2">Invite Members</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Member invitation via email is coming soon. Currently members can be added by user ID
          through the API.
        </p>
      </div>
    </main>
  );
}
