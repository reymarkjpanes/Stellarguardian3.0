import { EventRepository } from "../repositories/event.repository";
import { CreateEventDTO, EventResponseDTO } from "./dto/event.dto";
import { requirePermission } from "@/lib/auth/permissions";
import { BusinessRuleError, AppError } from "@/lib/errors";
import { eventBus } from "../domain/events";

export class EventService {
  private repository: EventRepository;

  constructor() {
    this.repository = new EventRepository();
  }

  async createEvent(
    userId: string,
    dto: CreateEventDTO
  ): Promise<EventResponseDTO> {
    // 1. Authorization Check (Domain Logic: Can this user create events here?)
    try {
      await requirePermission(dto.workspace_id, "workspace", "update");
    } catch (error: any) {
      // Re-throw appropriately based on central error logic if it's not already
      throw error;
    }

    // 2. Business Rules / Validation (Domain logic)
    if (dto.team_size_max < dto.team_size_min) {
      throw new BusinessRuleError("Maximum team size cannot be less than minimum team size.");
    }

    // 3. Database Operation via Repository (Transaction boundary)
    const event = await this.repository.createEventAtomic({
      ...dto,
      organizer_id: userId,
      state: "Draft",
    });

    // 4. Domain Events (Side effects decoupled)
    await eventBus.publish("EventCreated", {
      eventId: event.id,
      workspaceId: event.workspace_id,
      organizerId: event.organizer_id,
      title: event.title,
    });

    return event;
  }

  async listEvents(workspaceId: string | null, limit: number, offset: number) {
    return await this.repository.findMany(workspaceId, limit, offset);
  }
}
