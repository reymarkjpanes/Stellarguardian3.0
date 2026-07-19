import { createServerClient } from "@/lib/supabase/server";
import { CreateEventDTO, EventResponseDTO } from "../application/dto/event.dto";

export class EventRepository {
  /**
   * Calls a Supabase RPC to atomically create an event and insert the organizer as a member.
   */
  async createEventAtomic(
    data: CreateEventDTO & { organizer_id: string; state: string }
  ): Promise<EventResponseDTO> {
    const supabase = await createServerClient();

    // The RPC will handle the transaction boundary
    const { data: event, error } = await supabase.rpc("create_event_with_member", {
      event_payload: {
        workspace_id: data.workspace_id,
        organizer_id: data.organizer_id,
        title: data.title,
        description: data.description,
        category: data.category,
        format: data.format,
        tags: data.tags,
        team_size_min: data.team_size_min,
        team_size_max: data.team_size_max,
        registration_deadline: data.registration_deadline ?? null,
        prize_pool_target: data.prize_pool_target ?? null,
        network_mode: data.network_mode,
        review_window_hours: data.review_window_hours,
        resubmission_policy: data.resubmission_policy,
        file_policy: data.file_policy,
        state: data.state,
      }
    });

    if (error) {
      console.error("[EventRepository.createEventAtomic] Error:", error);
      throw new Error(error.message); // Will be caught by service layer
    }

    return event as EventResponseDTO;
  }

  async findMany(workspaceId?: string | null, limit = 20, offset = 0) {
    const supabase = await createServerClient();

    let query = supabase
      .from("events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data: events, count, error } = await query;

    if (error) {
      console.error("[EventRepository.findMany] Error:", error);
      throw new Error(error.message);
    }

    return {
      data: (events ?? []) as EventResponseDTO[],
      total: count ?? 0,
    };
  }
}
