import { TeamDetailDTO, TeamListDTO } from "../../api/dto/TeamDTO";
import { CursorPaginationParams, PaginatedResult } from "@/src/shared/kernel/api/Pagination";
import { TeamSearchQuery } from "../../application/queries/TeamSearchQuery";
import postgres from "postgres";

export interface TeamReadRepository {
  findTeamDetail(sql: postgres.Sql, eventId: string, teamId: string): Promise<TeamDetailDTO | null>;
  listTeams(sql: postgres.Sql, eventId: string, params: CursorPaginationParams): Promise<PaginatedResult<TeamListDTO>>;
  searchTeams(sql: postgres.Sql, query: TeamSearchQuery): Promise<PaginatedResult<TeamListDTO>>;
}
