/**
 * POST /api/events — Create a new event (Req 12).
 * GET  /api/events — List events (with workspace filter).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { EventService } from "@/lib/application/event.service";
import { CreateEventSchema } from "@/lib/application/dto/event.dto";

const eventService = new EventService();

export const POST = apiHandler({
  requireAuth: true,
  schema: CreateEventSchema,
}, async ({ user, body }) => {
  const event = await eventService.createEvent(user!.id, body);
  return NextResponse.json({ data: event }, { status: 201 });
});

const GetEventsSchema = z.object({
  workspace_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const GET = apiHandler({
  requireAuth: true,
  schema: GetEventsSchema,
}, async ({ body: { workspace_id, limit, offset } }) => {
  const result = await eventService.listEvents(workspace_id ?? null, limit, offset);
  return NextResponse.json({
    data: result.data,
    meta: { total: result.total, limit, offset },
  });
});
