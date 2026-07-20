"use client";

import { useSearchParams, useParams } from "next/navigation";
import { CommunityDirectory } from "./CommunityDirectory";
import { RecruitmentDirectory } from "./RecruitmentDirectory";
import { ManagementTable } from "./ManagementTable";
import { useMembersQuery } from "../hooks/useMembersQuery";
import { useRecruitingTeamsQuery } from "@/src/domains/teams/hooks/useRecruitingTeamsQuery";

export function MembersContent() {
  const params = useParams();
  const eventId = params.id as string;
  const searchParams = useSearchParams();
  
  const currentView = searchParams.get("view") || "community";
  const filters = {
    role: searchParams.get("role") || "",
    availability: searchParams.get("availability") || ""
  };

  const { data: members, isLoading: isMembersLoading } = useMembersQuery(eventId, filters);
  const { data: teams, isLoading: isTeamsLoading } = useRecruitingTeamsQuery(eventId, filters);

  return (
    <div className="mt-4">
      {currentView === "community" && <CommunityDirectory members={members || []} isLoading={isMembersLoading} />}
      {currentView === "recruitment" && <RecruitmentDirectory teams={teams || []} isLoading={isTeamsLoading} />}
      {currentView === "management" && <ManagementTable members={members || []} isLoading={isMembersLoading} />}
    </div>
  );
}
