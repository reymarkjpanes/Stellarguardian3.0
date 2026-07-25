import { NextResponse } from "next/server";
import { UpdateTeamSchema } from "@/src/domains/teams/api/schema";
import { UpdateTeamUseCase } from "@/src/domains/teams/application/commands/UpdateTeamUseCase";
import { GetTeamQuery } from "@/src/domains/teams/application/queries/GetTeamQuery";
import { PostgresTeamRepository } from "@/src/domains/teams/infrastructure/PostgresTeamRepository";
import { OutboxPublisher } from "@/src/shared/kernel/events/OutboxPublisher";
import { PostgresUnitOfWork, sql } from "@/src/shared/kernel/database";
import { successResponse } from "@/src/shared/kernel/api/ApiResponse";
import { withPipeline } from "@/src/shared/kernel/api/middleware/withPipeline";

interface TeamParams {
  eventId: string;
  teamId: string;
}

export const GET = withPipeline<TeamParams>(
  async (_request, ctx, params) => {
    const { eventId, teamId } = params;

    const mockReadRepo = new PostgresTeamRepository();
    const queryService = new GetTeamQuery(sql, mockReadRepo);
    const result = await queryService.execute(eventId, teamId, ctx);

    return NextResponse.json(successResponse(result), { status: 200 });
  },
  {
    requireAuth: true,
    rateLimitPolicy: "AuthenticatedRead",
  },
);

export const PATCH = withPipeline<TeamParams>(
  async (request, ctx, params, body) => {
    const { teamId } = params;

    const uow = new PostgresUnitOfWork();
    const repo = new PostgresTeamRepository();
    const eventBus = new OutboxPublisher(sql);

    const version = request.headers.get("if-match");

    const useCase = new UpdateTeamUseCase(uow, repo, eventBus);

    await useCase.execute(
      {
        teamId,
        version: version ? parseInt(version, 10) : undefined,
        ...(body as Record<string, unknown>),
      },
      ctx,
    );

    return NextResponse.json(successResponse(null), { status: 200 });
  },
  {
    requireAuth: true,
    rateLimitPolicy: "AuthenticatedWrite",
    idempotent: true,
    bodySchema: UpdateTeamSchema,
  },
);
