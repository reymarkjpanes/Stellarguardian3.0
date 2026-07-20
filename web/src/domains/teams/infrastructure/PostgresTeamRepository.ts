import { TeamWriteRepository } from "../domain/repositories/TeamWriteRepository";
import { TeamReadRepository } from "../domain/repositories/TeamReadRepository";
import { Team, TeamProps } from "../domain/Team";
import { RequestContext } from "@/src/shared/kernel/context/RequestContext";
import { TeamDetailDTO, TeamListDTO } from "../api/dto/TeamDTO";
import { CursorPaginationParams, PaginatedResult } from "@/src/shared/kernel/api/Pagination";
import { ConflictError } from "@/src/shared/kernel/errors/DomainError";
import { TeamSearchQuery } from "../application/queries/TeamSearchQuery";
import postgres from "postgres";

export class PostgresTeamRepository implements TeamWriteRepository, TeamReadRepository {
  
  // -- WRITE REPOSITORY --

  async findById(tx: postgres.Sql, id: string): Promise<Team | null> {
    const teams = await tx`
      SELECT id, event_id, name, status, visibility, max_members, version
      FROM teams
      WHERE id = ${id}
    `;

    if (teams.length === 0) return null;
    const teamRow = teams[0];
    if (!teamRow) return null;

    const members = await tx`
      SELECT event_member_id, role, status
      FROM team_memberships
      WHERE team_id = ${id}
    `;

    const props: TeamProps = {
      id: teamRow.id,
      eventId: teamRow.event_id,
      name: teamRow.name,
      status: teamRow.status,
      visibility: teamRow.visibility,
      maxMembers: teamRow.max_members,
      version: teamRow.version,
      members: members.map(m => ({
        eventMemberId: m.event_member_id,
        role: m.role,
        status: m.status
      }))
    };

    return new Team(props);
  }

  async create(tx: postgres.Sql, team: Omit<Team, "id">, ctx: RequestContext): Promise<string> {
    const t = team as any; // Cast for simplicity since Omit loses getter methods
    const result = await tx`
      INSERT INTO teams (
        event_id, name, status, visibility, max_members, created_by
      ) VALUES (
        ${t.props.eventId}, ${t.props.name}, ${t.props.status}, ${t.props.visibility}, ${t.props.maxMembers}, ${ctx.user.id}
      )
      RETURNING id
    `;
    const row = result[0];
    if (!row) throw new Error("Failed to create team");
    return row.id;
  }

  async update(tx: postgres.Sql, team: Team, ctx: RequestContext): Promise<void> {
    const t = team as any;
    const result = await tx`
      UPDATE teams
      SET status = ${t.props.status}, visibility = ${t.props.visibility}, version = version + 1
      WHERE id = ${team.id} AND version = ${t.props.version}
    `;

    if (result.count === 0) {
      throw new ConflictError("Concurrency Conflict: The team has been updated by another request.");
    }
  }

  async addMember(tx: postgres.Sql, teamId: string, eventMemberId: string, role: string, ctx: RequestContext): Promise<void> {
    await tx`
      INSERT INTO team_memberships (
        team_id, event_member_id, role, status
      ) VALUES (
        ${teamId}, ${eventMemberId}, ${role}, 'Active'
      )
    `;
  }

  // -- READ REPOSITORY --

  async findTeamDetail(sql: postgres.Sql, eventId: string, teamId: string): Promise<TeamDetailDTO | null> {
    const teams = await sql`
      SELECT id, name, status, visibility, max_members, created_at
      FROM teams
      WHERE event_id = ${eventId} AND id = ${teamId}
    `;
    if (teams.length === 0) return null;
    const t = teams[0];
    if (!t) return null;

    const members = await sql`
      SELECT event_member_id, role, created_at
      FROM team_memberships
      WHERE team_id = ${teamId}
    `;

    return {
      id: t.id,
      name: t.name,
      status: t.status,
      visibility: t.visibility,
      lookingForMembers: true,
      memberCount: members.length,
      maxMembers: t.max_members,
      createdAt: t.created_at,
      members: members.map(m => ({
        eventMemberId: m.event_member_id,
        role: m.role,
        name: "Unknown", // Would join users/event_members table
        joinedAt: m.created_at
      }))
    };
  }

  async listTeams(sql: postgres.Sql, eventId: string, params: CursorPaginationParams): Promise<PaginatedResult<TeamListDTO>> {
    const limit = params.limit || 20;
    
    // Simplistic pagination just for the skeleton
    const teams = await sql`
      SELECT id, name, status, visibility, max_members, created_at
      FROM teams
      WHERE event_id = ${eventId}
      ORDER BY created_at DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = teams.length > limit;
    const items = hasMore ? teams.slice(0, limit) : teams;

    const dtos: TeamListDTO[] = items.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      visibility: t.visibility,
      lookingForMembers: true,
      memberCount: 1, // Mock
      maxMembers: t.max_members,
      createdAt: t.created_at
    }));

    return {
      items: dtos,
      hasMore,
      nextCursor: hasMore ? dtos[dtos.length - 1]?.id : undefined
    };
  }

  async searchTeams(sql: postgres.Sql, query: TeamSearchQuery): Promise<PaginatedResult<TeamListDTO>> {
    const limit = query.limit || 20;
    const visibility = query.visibility;

    let teams;
    if (visibility) {
      teams = await sql`
        SELECT id, name, status, visibility, max_members, created_at
        FROM teams
        WHERE event_id = ${query.eventId} AND visibility = ${visibility}
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    } else {
      teams = await sql`
        SELECT id, name, status, visibility, max_members, created_at
        FROM teams
        WHERE event_id = ${query.eventId}
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    }

    const hasMore = teams.length > limit;
    const items = hasMore ? teams.slice(0, limit) : teams;

    const dtos: TeamListDTO[] = items.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      visibility: t.visibility,
      lookingForMembers: true,
      memberCount: 1, // Mock
      maxMembers: t.max_members,
      createdAt: t.created_at
    }));

    return {
      items: dtos,
      hasMore,
      nextCursor: hasMore ? dtos[dtos.length - 1]?.id : undefined
    };
  }
}

