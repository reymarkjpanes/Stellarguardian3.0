import { NextResponse } from "next/server";
import { CreateTeamSchema } from "@/src/domains/teams/api/schema";
import { CreateTeamUseCase } from "@/src/domains/teams/application/commands/CreateTeamUseCase";
import { ListTeamsQuery } from "@/src/domains/teams/application/queries/ListTeamsQuery";
import { PostgresTeamRepository } from "@/src/domains/teams/infrastructure/PostgresTeamRepository";
import { OutboxPublisher } from "@/src/shared/kernel/events/OutboxPublisher";
import { PostgresUnitOfWork, sql } from "@/src/shared/kernel/database";
import { successResponse } from "@/src/shared/kernel/api/ApiResponse";
import { withPipeline } from "@/src/shared/kernel/api/middleware/withPipeline";
import { CursorPaginationSchema } from "@/src/shared/kernel/api/Pagination";

interface EventParams {
  eventId: string;
}

export const GET = withPipeline<EventParams>(
  async (request, ctx, params) => {
    const { eventId } = params;

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = url.searchParams.has("limit")
      ? parseInt(url.searchParams.get("limit")!, 10)
      : undefined;

    const paginationResult = CursorPaginationSchema.safeParse({ cursor, limit });
    const pagination = paginationResult.success
      ? { ...paginationResult.data, limit: paginationResult.data.limit ?? 20 }
      : { limit: 20 };

    const readRepo = new PostgresTeamRepository();
    const queryService = new ListTeamsQuery(sql, readRepo);

    const result = await queryService.execute(eventId, pagination, ctx);

    return NextResponse.json(
      successResponse(result.items, {
        nextCursor: result.nextCursor,
        hasNext: result.hasMore,
        count: result.items.length,
      }),
      { status: 200 },
    );
  },
  {
    requireAuth: true,
    rateLimitPolicy: "PublicRead",
  },
);

export const POST = withPipeline<EventParams>(
  async (_request, ctx, params, body) => {
    const { eventId } = params;

    const uow = new PostgresUnitOfWork();
    const repo = new PostgresTeamRepository();
    const eventBus = new OutboxPublisher(sql);

    const useCase = new CreateTeamUseCase(uow, repo, eventBus);

    const teamId = await useCase.execute({ eventId, ...(body as Record<string, unknown>) }, ctx);

    return NextResponse.json(successResponse({ id: teamId }), { status: 201 });
  },
  {
    requireAuth: true,
    rateLimitPolicy: "AuthenticatedWrite",
    idempotent: true,
    bodySchema: CreateTeamSchema,
  },
);
