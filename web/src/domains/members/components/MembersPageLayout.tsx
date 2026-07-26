"use client";

import { MembersToolbar } from "./MembersToolbar";
import { MembersFilters } from "./MembersFilters";

export function MembersPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Event Directory</h1>
        <p className="text-muted-foreground">Find teammates, manage members, and discover teams.</p>
      </div>

      <MembersToolbar />

      {/* Mobile-friendly: On mobile this could collapse into a sheet/modal */}
      <MembersFilters />

      <main className="mt-4">{children}</main>
    </div>
  );
}
