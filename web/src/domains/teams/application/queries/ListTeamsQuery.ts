import { TeamReadRepository } from "../../domain/repositories/TeamReadRepository";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { TeamListDTO } from "../../api/dto/TeamDTO";
import { CursorPaginationParams, PaginatedResult } from "@/src/shared/kernel/api/Pagination";
import postgres from "postgres";

export class ListTeamsQuery {
  constructor(
    private sql: postgres.Sql,
    private teamReadRepository: TeamReadRepository,
  ) {}

  async execute(
    eventId: string,
    params: CursorPaginationParams,
    _ctx: RequestContext,
  ): Promise<PaginatedResult<TeamListDTO>> {
    return this.teamReadRepository.listTeams(this.sql, eventId, params);
  }
}
