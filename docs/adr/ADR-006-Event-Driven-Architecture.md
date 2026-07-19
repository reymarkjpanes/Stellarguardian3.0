# ADR-006: Event-Driven Architecture for Side Effects

**Date:** 2026-07-19  
**Status:** Accepted  

## Context
The current application architecture attempts to execute side effects (notifications, caching, webhooks, audit logging) sequentially within the main API request handler. This tightly couples domains, increases API latency, and makes the system brittle—if the notification service fails, the entire request might fail or leave the system in an inconsistent state.

## Decision
We will implement an Event-Driven Architecture (EDA) to handle side effects. The primary mutation endpoint will only be responsible for executing the core business transaction and publishing a Domain Event. 

For example, when an event is created:
1. Core API handles Event Creation (via DB Transaction).
2. API publishes an `EventCreated` domain event.
3. Immediate response returned to user.
4. Independent background handlers (Subscribers) react to `EventCreated` to process:
   - Audit Logging
   - Sending Notifications
   - Refreshing Caches
   - Dispatching Webhooks

## Trade-offs
**Pros:**
- Drastically reduces API response latency for users.
- Decouples core business logic from auxiliary services.
- Fault isolation: a failed webhook delivery does not revert the event creation.
- Scalability: Handlers can be processed asynchronously or scaled independently.

**Cons:**
- Eventual consistency means the UI might need to poll or rely on WebSockets for side-effect completion (like notifications).
- Introduces infrastructural complexity (requires an event bus or background job queue like Inngest, Upstash QStash, or Supabase Database Webhooks).

## Migration Plan
1. Select a background job / event bus provider (e.g., Upstash QStash or Supabase Webhooks).
2. Refactor existing API endpoints to publish events rather than invoking side-effect services directly.
3. Build dedicated handler endpoints/functions to process incoming domain events and execute the side-effect logic with retry policies.
