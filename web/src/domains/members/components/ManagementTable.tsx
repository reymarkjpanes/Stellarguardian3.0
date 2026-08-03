"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MemberDirectoryProjection } from "../api/dto/MemberProjections";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { Column } from "@/components/ui/data-table";

function MemberActions({ member }: { member: MemberDirectoryProjection }) {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function updateMember(data: { status: string } | { role: string }) {
    if (loading) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) router.refresh();
      else setActionError("Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeMember() {
    if (loading) return;
    setConfirmRemove(false);
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/members/${member.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
      else setActionError("Removal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {actionError && (
        <p className="text-[10px] text-red-500">{actionError}</p>
      )}
      <div className="flex justify-end gap-2 text-sm">
        {member.membershipStatus === "Pending" ? (
          <>
            <button
              onClick={() => updateMember({ status: "Approved" })}
              className="text-green-600 font-medium hover:underline disabled:opacity-50"
              disabled={loading}
            >
              Approve
            </button>
            <button
              onClick={() => updateMember({ status: "Rejected" })}
              className="text-red-600 font-medium hover:underline disabled:opacity-50"
              disabled={loading}
            >
              Reject
            </button>
          </>
        ) : (
          <>
            <select
              value={member.eventRole}
              onChange={(e) => updateMember({ role: e.target.value })}
              className="bg-transparent border border-border rounded px-2 py-1 text-xs"
              disabled={loading}
            >
              <option value="Participant">Participant</option>
              <option value="Judge">Judge</option>
              <option value="Organizer">Organizer</option>
              <option value="Mentor">Mentor</option>
              <option value="Sponsor">Sponsor</option>
            </select>
            {!confirmRemove ? (
              <button
                onClick={() => setConfirmRemove(true)}
                className="text-red-600 hover:underline disabled:opacity-50"
                disabled={loading}
              >
                Remove
              </button>
            ) : (
              <span className="flex items-center gap-1">
                <button onClick={removeMember} className="text-[10px] font-medium text-red-600 hover:underline">
                  Yes
                </button>
                <button onClick={() => setConfirmRemove(false)} className="text-[10px] text-muted-foreground hover:text-foreground">
                  No
                </button>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const columns: Column<MemberDirectoryProjection>[] = [
  {
    key: "displayName",
    header: "Member",
    render: (item) => <>{item.displayName}</>,
  },
  {
    key: "eventRole",
    header: "Role",
    render: (item) => <>{item.eventRole}</>,
  },
  {
    key: "membershipStatus",
    header: "Status",
    render: (item) => (
      <span className={item.membershipStatus === "Pending" ? "text-amber-500 font-medium" : ""}>
        {item.membershipStatus}
      </span>
    ),
  },
  {
    key: "teamName",
    header: "Team",
    render: (item) => <>{item.teamName || "-"}</>,
  },
  {
    key: "actions",
    header: "",
    render: (item) => <MemberActions member={item} />,
  },
];

export function ManagementTable({
  members,
  isLoading,
}: {
  members: MemberDirectoryProjection[];
  isLoading?: boolean;
}) {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRole, setBulkRole] = useState("");
  const [confirmBulk, setConfirmBulk] = useState<{ action: "approve" | "reject" | "role"; role?: string } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-md"></div>
        ))}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <EmptyState
        title="No members registered yet."
        description="Participants, judges, and mentors will appear here once they join."
      />
    );
  }

  async function handleBulkUpdate(action: "approve" | "reject" | "role", roleValue?: string) {
    if (selectedKeys.size === 0) return;
    setBulkLoading(true);
    setConfirmBulk(null);
    try {
      const promises = Array.from(selectedKeys).map((userId) => {
        const member = members.find((m) => m.userId === userId);
        if (!member) return Promise.resolve();
        const data =
          action === "role"
            ? { role: roleValue }
            : { status: action === "approve" ? "Approved" : "Rejected" };
        return fetch(`/api/events/${eventId}/members/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      });
      await Promise.all(promises);
      setSelectedKeys(new Set());
      router.refresh();
    } finally {
      setBulkLoading(false);
      setBulkRole("");
    }
  }

  return (
    <div className="space-y-4">
      {selectedKeys.size > 0 && (
        <div className="p-3 bg-[var(--bg-muted)] border border-[var(--border)] rounded-md space-y-2">
          {confirmBulk ? (
            <div role="alertdialog" aria-label="Confirm bulk action" className="flex items-center gap-3">
              <p className="text-sm text-[var(--text)] flex-1">
                {confirmBulk.action === "role"
                  ? `Assign "${confirmBulk.role}" to ${selectedKeys.size} member${selectedKeys.size !== 1 ? "s" : ""}?`
                  : `${confirmBulk.action === "approve" ? "Approve" : "Reject"} ${selectedKeys.size} member${selectedKeys.size !== 1 ? "s" : ""}?`}
              </p>
              <button
                onClick={() => handleBulkUpdate(confirmBulk.action, confirmBulk.role)}
                disabled={bulkLoading}
                className="px-3 py-1 text-xs font-medium bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {bulkLoading ? "Applying…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmBulk(null)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm font-medium text-[var(--text)]">
                {selectedKeys.size} member{selectedKeys.size !== 1 && "s"} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmBulk({ action: "approve" })}
                  disabled={bulkLoading}
                  className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => setConfirmBulk({ action: "reject" })}
                  disabled={bulkLoading}
                  className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
                <div className="flex items-center gap-1 border-l border-[var(--border)] pl-2 ml-1">
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value)}
                    disabled={bulkLoading}
                    className="bg-[var(--input-bg)] border border-[var(--border)] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  >
                    <option value="" disabled>Assign Role...</option>
                    <option value="Participant">Participant</option>
                    <option value="Judge">Judge</option>
                    <option value="Organizer">Organizer</option>
                    <option value="Mentor">Mentor</option>
                    <option value="Sponsor">Sponsor</option>
                  </select>
                  <button
                    onClick={() => bulkRole && setConfirmBulk({ action: "role", role: bulkRole })}
                    disabled={bulkLoading || !bulkRole}
                    className="px-3 py-1 text-xs font-medium btn-secondary disabled:opacity-50 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="rounded-md border bg-card overflow-hidden">
        <DataTable
          columns={columns}
          data={members}
          keyExtractor={(item) => item.userId}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
        />
      </div>
    </div>
  );
}
