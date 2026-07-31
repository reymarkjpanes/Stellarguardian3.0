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

  async function updateMember(data: { status: string } | { role: string }) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) router.refresh();
      else alert("Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeMember() {
    if (loading || !confirm(`Remove ${member.displayName}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/members/${member.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
      else alert("Removal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
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
          <button
            onClick={removeMember}
            className="text-red-600 hover:underline disabled:opacity-50"
            disabled={loading}
          >
            Remove
          </button>
        </>
      )}
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
    if (!confirm(`Are you sure you want to ${action} ${selectedKeys.size} members?`)) return;

    setBulkLoading(true);
    try {
      // In a real app, you would have a bulk endpoint, but for now we can do promise.all
      // or implement a new bulk API route. Since we just have the single PATCH endpoint:
      const promises = Array.from(selectedKeys).map((userId) => {
        // find member id from userId
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
        <div className="p-3 bg-[var(--bg-muted)] border border-[var(--border)] rounded-md flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm font-medium text-[var(--text)]">
            {selectedKeys.size} member{selectedKeys.size !== 1 && "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkUpdate("approve")}
              disabled={bulkLoading}
              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleBulkUpdate("reject")}
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
                <option value="" disabled>
                  Assign Role...
                </option>
                <option value="Participant">Participant</option>
                <option value="Judge">Judge</option>
                <option value="Organizer">Organizer</option>
                <option value="Mentor">Mentor</option>
                <option value="Sponsor">Sponsor</option>
              </select>
              <button
                onClick={() => handleBulkUpdate("role", bulkRole)}
                disabled={bulkLoading || !bulkRole}
                className="px-3 py-1 text-xs font-medium btn-secondary disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
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
