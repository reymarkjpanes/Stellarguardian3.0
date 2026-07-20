import { Suspense } from "react";
import { MembersPageLayout } from "@/src/domains/members/components/MembersPageLayout";
import { MembersContent } from "@/src/domains/members/components/MembersContent";

export default function MembersPage() {
  return (
    <Suspense fallback={<div>Loading directory...</div>}>
      <MembersPageLayout>
        <MembersContent />
      </MembersPageLayout>
    </Suspense>
  );
}
