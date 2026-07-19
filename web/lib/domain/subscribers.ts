import { eventBus, type EventCreatedPayload } from "./events";
import { createServerClient } from "@/lib/supabase/server";

export function registerDomainEventSubscribers() {
  eventBus.subscribe<EventCreatedPayload>("EventCreated", async (payload) => {
    const supabase = await createServerClient();
    
    // Log audit event asynchronously
    await supabase.from("audit_logs").insert({
      workspace_id: payload.workspaceId,
      actor_id: payload.organizerId,
      action: "event.create",
      resource: "event",
      resource_id: payload.eventId,
      metadata: {
        title: payload.title
      }
    });
    
    console.log(`[DomainEvent] Processed EventCreated for ${payload.eventId}`);
  });
}
