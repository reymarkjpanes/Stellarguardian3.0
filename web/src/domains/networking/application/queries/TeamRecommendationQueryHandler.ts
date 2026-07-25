import { PaginatedResult } from "@/src/shared/kernel/api/Pagination";
import { DiscoveryService } from "../services/DiscoveryService";

export interface TeamRecommendationQuery {
  eventId: string;
  memberId: string;
  page?: number;
  limit?: number;
}

export class TeamRecommendationQueryHandler {
  constructor(private discoveryService: DiscoveryService) {}

  async execute(query: TeamRecommendationQuery): Promise<PaginatedResult<Record<string, unknown>>> {
    const recommendations = await this.discoveryService.getSuggestedTeams(
      query.memberId,
      query.limit,
    );
    return {
      items: recommendations,
      hasMore: false,
      totalCount: recommendations.length,
    };
  }
}
