import { UnitOfWork } from "@/src/shared/kernel/database";
import { EventPublisher } from "@/src/shared/kernel/events/EventBus";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { TeamWriteRepository } from "../../domain/repositories/TeamWriteRepository";
import { Team, TeamProps } from "../../domain/Team";
import postgres from "postgres";

export interface CreateTeamCommand {
  eventId: string;
  name: string;
  maxMembers: number;
  visibility: string;
}

export class CreateTeamUseCase {
  constructor(
    private uow: UnitOfWork,
    private teamRepository: TeamWriteRepository,
    private eventPublisher: EventPublisher
  ) {}

  async execute(command: CreateTeamCommand, ctx: RequestContext): Promise<string> {
    return this.uow.execute(async (tx: postgres.Sql) => {
      
      const teamProps: TeamProps = {
        id: "", // Will be assigned by DB
        eventId: command.eventId,
        name: command.name,
        status: "Draft",
        visibility: command.visibility,
        maxMembers: command.maxMembers,
        members: [],
        version: 1
      };

      const team = new Team(teamProps);
      
      // 1. Create Team in DB
      const teamId = await this.teamRepository.create(tx, team, ctx);

      // 2. Add creator as Captain
      await this.teamRepository.addMember(tx, teamId, ctx.user.id, "Captain", ctx);

      // 3. Publish Domain Event (saved to outbox within transaction via EventPublisher)
      await this.eventPublisher.publish({
        type: "TeamCreated",
        aggregateId: teamId,
        aggregateType: "Team",
        payload: {
          name: command.name,
          captainId: ctx.user.id
        },
        timestamp: new Date().toISOString(),
        metadata: {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId
        }
      });

      return teamId;
    });
  }
}
