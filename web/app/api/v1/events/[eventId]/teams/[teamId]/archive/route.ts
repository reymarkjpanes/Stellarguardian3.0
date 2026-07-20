import { NextResponse } from "next/server";
import { ArchiveTeamUseCase } from "@/src/domains/teams/application/commands/ArchiveTeamUseCase";
import { PostgresTeamRepository } from "@/src/domains/teams/infrastructure/PostgresTeamRepository";
import { OutboxPublisher } from "@/src/shared/kernel/events/OutboxPublisher";
import { PostgresUnitOfWork, sql } from "@/src/shared/kernel/database";
import { withPipeline } from "@/src/shared/kernel/api/middleware/withPipeline";
import { z } from "zod";

export const POST = withPipeline(
  async (request, ctx, params) => {
    const { teamId } = params as any;
    
    const uow = new PostgresUnitOfWork();
    const repo = new PostgresTeamRepository(); 
    const eventBus = new OutboxPublisher(sql);
    
    const version = request.headers.get("if-match");

    const useCase = new ArchiveTeamUseCase(uow, repo, eventBus);

    await useCase.execute({ 
      teamId,
      version: version ? parseInt(version, 10) : undefined 
    }, ctx);

    return new NextResponse(null, { status: 204 });
  },
  {
    requireAuth: true,
    rateLimitPolicy: "SensitiveActions",
    idempotent: true
  }
);
