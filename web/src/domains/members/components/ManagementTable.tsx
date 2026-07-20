"use client";

import { MemberDirectoryProjection } from "../api/dto/MemberProjections";
import { DataTable } from "@/components/ui/data-table";

import { Column } from "@/components/ui/data-table";

// A simplified definition of columns that works with the existing data-table component
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
    key: "activityStatus",
    header: "Availability",
    render: (item) => <>{item.activityStatus}</>
  },
  {
    key: "teamName",
    header: "Team",
    render: (item) => <>{item.teamName || "-"}</>
  },
  {
    key: "actions",
    header: "",
    render: () => <div className="text-right"><button className="text-sm text-primary">Manage</button></div>
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
      <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl">
        <h3 className="text-lg font-medium">No members registered yet.</h3>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <DataTable columns={columns} data={members} keyExtractor={(item) => item.userId} />
    </div>
  );
}
