import { DomainEvent } from "../domain/EventDispatcher";

export class AnalyticsHandler {
  async handle(event: DomainEvent): Promise<void> {
    // Send event data to an analytics service (e.g. Mixpanel, PostHog, or a data warehouse)
    // For RecommendationViewed, ProfileViewed, TeamMatched
    console.log(`[Analytics] Tracked event: ${event.type}`);
  }
}
