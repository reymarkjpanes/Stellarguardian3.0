import { Suspense } from "react";
import { MembersPageLayout } from "@/src/domains/members/components/MembersPageLayout";
import { MembersContent } from "@/src/domains/members/components/MembersContent";

function MembersSkeleton() {
  return (
    <div className="animate-pulse space-y-4 max-w-4xl">
      {/* Header */}
      <div className="h-7 w-48 bg-[var(--bg-muted)] rounded" />
      <div className="h-4 w-72 bg-[var(--bg-muted)] rounded" />
      {/* Rows */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-[var(--bg-muted)] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-[var(--bg-muted)] rounded" />
            <div className="h-3 w-56 bg-[var(--bg-muted)] rounded" />
          </div>
          <div className="h-6 w-20 bg-[var(--bg-muted)] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <MembersPageLayout>
        <MembersContent />
      </MembersPageLayout>
    </Suspense>
  );
}
