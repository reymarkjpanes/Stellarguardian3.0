import { UnitOfWork } from "@/src/shared/kernel/database";
import { EventPublisher } from "@/src/shared/kernel/events/EventBus";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { TeamWriteRepository } from "../../domain/repositories/TeamWriteRepository";
import { NotFoundError, UnauthorizedError, StateTransitionError, ConflictError } from "@/src/shared/kernel/errors/DomainError";
import { createTeamStateMachine } from "../../domain/TeamStateMachine";
import postgres from "postgres";
import { permissionService } from "@packages/shared-kernel/domain/PermissionService";
import { Permission } from "@packages/shared-kernel/constants/permissions";
import { TeamStatusType } from "@packages/shared-kernel/constants/statuses";

export interface ArchiveTeamCommand {
  teamId: string;
  version?: number;
}

export class ArchiveTeamUseCase {
  constructor(
    private uow: UnitOfWork,
    private teamRepository: TeamWriteRepository,
    private eventPublisher: EventPublisher
  ) {}

  async execute(command: ArchiveTeamCommand, ctx: RequestContext): Promise<void> {
    return this.uow.execute(async (tx: postgres.Sql) => {
      
      const team = await this.teamRepository.findById(tx, command.teamId);
      if (!team) {
        throw new NotFoundError("Team not found");
      }

      if (command.version !== undefined && team.version !== command.version) {
        throw new ConflictError("Concurrency Conflict: The team has been updated by another request.");
      }

      // Ensure actor is captain
      const canArchive = permissionService.can(Permission.ArchiveTeam, {
        role: ctx.user.role as any,
        isCaptain: team.isCaptain(ctx.user.id),
        teamStatus: team.status as TeamStatusType
      });

      if (!canArchive) {
        throw new UnauthorizedError("Only the captain or an organizer can archive the team.", { code: "TEAM_CAPTAIN_REQUIRED" });
      }

      const stateMachine = createTeamStateMachine(team.status as TeamStatusType);
      
      const canTransition = stateMachine.canTransition("Archived" as TeamStatusType);
      if (!canTransition) {
        throw new StateTransitionError("Team cannot be archived from its current state.");
      }

      (team as any).props.status = "Archived";

      await this.teamRepository.update(tx, team, ctx);

      await this.eventPublisher.publish({
        type: "TeamArchived",
        aggregateId: team.id,
        aggregateType: "Team",
        payload: {},
        timestamp: new Date().toISOString(),
        metadata: {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId
        }
      });
    });
  }
}
