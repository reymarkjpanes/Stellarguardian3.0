"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MemberDirectoryProjection } from "../api/dto/MemberProjections";
import { DataTable } from "@/components/ui/data-table";
import { Column } from "@/components/ui/data-table";

function MemberActions({ member }: { member: MemberDirectoryProjection }) {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [loading, setLoading] = useState(false);

  async function updateMember(data: any) {
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
    render: (item) => <>{item.displayName}</>
  },
  {
    key: "eventRole",
    header: "Role",
    render: (item) => <>{item.eventRole}</>
  },
  {
    key: "membershipStatus",
    header: "Status",
    render: (item) => (
      <span className={item.membershipStatus === "Pending" ? "text-amber-500 font-medium" : ""}>
        {item.membershipStatus}
      </span>
    )
  },
  {
    key: "teamName",
    header: "Team",
    render: (item) => <>{item.teamName || "-"}</>
  },
  {
    key: "actions",
    header: "",
    render: (item) => <MemberActions member={item} />
  }
];

export function ManagementTable({ members, isLoading }: { members: MemberDirectoryProjection[], isLoading?: boolean }) {
  if (isLoading) {
    return <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-md"></div>)}
    </div>;
  }

  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-card">
        <h3 className="text-lg font-medium text-foreground">No members registered yet.</h3>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <DataTable columns={columns} data={members} keyExtractor={(item) => item.userId} />
    </div>
  );
}
