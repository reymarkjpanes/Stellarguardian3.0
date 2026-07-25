import { PaginatedResult } from "@/src/shared/kernel/api/Pagination";
import { DiscoveryService } from "../services/DiscoveryService";

export interface SuggestedMembersQuery {
  eventId: string;
  teamId: string;
  page?: number;
  limit?: number;
}

export class SuggestedMembersQueryHandler {
  constructor(private discoveryService: DiscoveryService) {}

  async execute(query: SuggestedMembersQuery): Promise<PaginatedResult<Record<string, unknown>>> {
    const recommendations = await this.discoveryService.getSuggestedMembers(
      query.teamId,
      query.limit,
    );
    return {
      items: recommendations,
      hasMore: false,
      totalCount: recommendations.length,
    };
  }
}
