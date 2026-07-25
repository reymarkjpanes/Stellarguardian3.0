import { UnitOfWork } from "@/src/shared/kernel/database";
import { EventPublisher } from "@/src/shared/kernel/events/EventBus";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { TeamWriteRepository } from "../../domain/repositories/TeamWriteRepository";
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
} from "@/src/shared/kernel/errors/DomainError";
import postgres from "postgres";
import { permissionService } from "@packages/shared-kernel/domain/PermissionService";
import { Permission } from "@packages/shared-kernel/constants/permissions";
import { TeamStatusType } from "@packages/shared-kernel/constants/statuses";

export interface UpdateTeamCommand {
  teamId: string;
  visibility?: string;
  status?: string;
  version?: number;
}

export class UpdateTeamUseCase {
  constructor(
    private uow: UnitOfWork,
    private teamRepository: TeamWriteRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(command: UpdateTeamCommand, ctx: RequestContext): Promise<void> {
    return this.uow.execute(async (tx: postgres.Sql) => {
      const team = await this.teamRepository.findById(tx, command.teamId);
      if (!team) {
        throw new NotFoundError("Team not found");
      }

      if (command.version !== undefined && team.version !== command.version) {
        throw new ConflictError(
          "Concurrency Conflict: The team has been updated by another request.",
        );
      }

      // Ensure actor is captain
      const canEdit = permissionService.can(Permission.EditTeam, {
        role: ctx.user.role as TeamStatusType,
        isCaptain: team.isCaptain(ctx.user.id),
        teamStatus: team.status as TeamStatusType,
      });

      if (!canEdit) {
        throw new UnauthorizedError("Only the captain or an organizer can update the team.", {
          code: "TEAM_CAPTAIN_REQUIRED",
        });
      }

      if (command.status) (team.props as { status: string }).status = command.status;
      if (command.visibility)
        (team.props as { visibility: string }).visibility = command.visibility;

      await this.teamRepository.update(tx, team, ctx);

      await this.eventPublisher.publish({
        type: "TeamUpdated", // Or more specific events
        aggregateId: team.id,
        aggregateType: "Team",
        payload: {
          status: team.status,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
        },
      });
    });
  }
}
