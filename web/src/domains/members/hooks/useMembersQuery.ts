import { useQuery } from "@tanstack/react-query";
import { MemberDirectoryProjection } from "../api/dto/MemberProjections";

interface RawSkill {
  skills?: {
    id: string;
    name: string;
    category: string;
  };
  experience_level: string;
}

interface RawMember {
  id: string;
  user_id: string;
  event_id: string;
  role: string;
  status?: string;
  availability?: string;
  teamId?: string;
  users?: {
    display_name?: string;
    avatar_url?: string;
    timezone?: string;
    user_skills?: RawSkill[];
  };
  profileMissing?: string[];
}

export function useMembersQuery(eventId: string, filters: Record<string, string>) {
  return useQuery({
    queryKey: ["members", eventId, filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.role) queryParams.set("role", filters.role);
      if (filters.availability) queryParams.set("availability", filters.availability);
      
      const res = await fetch(`/api/events/${eventId}/members?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch members");
      
      const json = await res.json();
      return (json.data ?? []).map((m: RawMember) => ({
        id: m.id,
        userId: m.user_id,
        eventId: m.event_id,
        handle: m.users?.display_name ?? "Unknown",
        displayName: m.users?.display_name ?? "Unknown",
        avatarUrl: m.users?.avatar_url ?? null,
        eventRole: m.role,
        membershipStatus: m.status ?? "Active",
        activityStatus: m.availability ?? "Available for Team",
        teamId: m.teamId,
        teamName: m.teamId ? "Team" : null, // we'd need team name from somewhere, or just leave as is
        teamRecruiting: false,
        timezone: m.users?.timezone ?? null,
        skills: m.users?.user_skills?.map((s: RawSkill) => ({
          id: s.skills?.id,
          name: s.skills?.name,
          category: s.skills?.category,
          experienceLevel: s.experience_level
        })) ?? [],
        profileCompletionScore: m.profileMissing?.length === 0 ? 100 : 50
      })) as MemberDirectoryProjection[];
    },
  });
}

