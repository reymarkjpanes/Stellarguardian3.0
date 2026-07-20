import { useQuery } from "@tanstack/react-query";
import { MemberDirectoryProjection } from "../api/dto/MemberProjections";

export function useMembersQuery(eventId: string, filters: Record<string, string>) {
  return useQuery({
    queryKey: ["members", eventId, filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.role) queryParams.set("role", filters.role);
      if (filters.availability) queryParams.set("availability", filters.availability);
      
      const res = await fetch(`/api/v1/events/${eventId}/members?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch members");
      
      const json = await res.json();
      return (json.data ?? []) as MemberDirectoryProjection[];
    },
  });
}
