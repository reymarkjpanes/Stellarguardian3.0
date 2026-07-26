import { TeamReadRepository } from "../../domain/repositories/TeamReadRepository";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { PaginatedResult } from "@/src/shared/kernel/api/Pagination";
import { TeamListDTO } from "../../api/dto/TeamDTO";
import { TeamSearchQuery } from "./TeamSearchQuery";
import postgres from "postgres";

export class TeamSearchQueryHandler {
  constructor(
    private sql: postgres.Sql,
    private teamReadRepository: TeamReadRepository,
  ) {}

  async execute(
    query: TeamSearchQuery,
    _ctx: RequestContext,
  ): Promise<PaginatedResult<TeamListDTO>> {
    return this.teamReadRepository.searchTeams(this.sql, query);
  }
}
