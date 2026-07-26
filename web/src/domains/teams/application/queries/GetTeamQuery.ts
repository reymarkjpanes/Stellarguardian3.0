import { TeamReadRepository } from "../../domain/repositories/TeamReadRepository";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { TeamDetailDTO } from "../../api/dto/TeamDTO";
import { NotFoundError } from "@/src/shared/kernel/errors/DomainError";
import postgres from "postgres";

export class GetTeamQuery {
  constructor(
    private sql: postgres.Sql,
    private teamReadRepository: TeamReadRepository,
  ) {}

  async execute(eventId: string, teamId: string, _ctx: RequestContext): Promise<TeamDetailDTO> {
    const team = await this.teamReadRepository.findTeamDetail(this.sql, eventId, teamId);
    if (!team) {
      throw new NotFoundError("Team not found");
    }
    return team;
  }
}
