import { Team } from "../Team";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import postgres from "postgres";

export interface TeamWriteRepository {
  findById(tx: postgres.Sql, id: string): Promise<Team | null>;
  create(tx: postgres.Sql, team: Omit<Team, "id">, ctx: RequestContext): Promise<string>;
  update(tx: postgres.Sql, team: Team, ctx: RequestContext): Promise<void>;
  addMember(tx: postgres.Sql, teamId: string, eventMemberId: string, role: string, ctx: RequestContext): Promise<void>;
}
