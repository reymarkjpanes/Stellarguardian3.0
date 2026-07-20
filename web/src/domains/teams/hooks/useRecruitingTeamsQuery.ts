import { useQuery } from "@tanstack/react-query";
import { TeamListDTO } from "../api/dto/TeamDTO";

export function useRecruitingTeamsQuery(eventId: string, filters: Record<string, string>) {
  return useQuery({
    queryKey: ["teams", "recruiting", eventId, filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      // Add any specific filters here
      
      const res = await fetch(`/api/v1/events/${eventId}/teams/recruiting?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch recruiting teams");
      
      const json = await res.json();
      return (json.data ?? []) as TeamListDTO[];
    },
  });
}
