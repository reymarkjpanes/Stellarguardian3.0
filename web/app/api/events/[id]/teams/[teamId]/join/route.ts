/**
 * Team Join API Routes
 *
 * POST /api/events/[id]/teams/[teamId]/join — Request to join team
 * PATCH /api/events/[id]/teams/[teamId]/join — Accept/reject request
 */
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";
import { okResponse } from "@/lib/errors/responses";
import { CompetitionEngine } from "@/lib/engine/competition.engine";

const JoinRequestSchema = z.object({
  message: z.string().max(500).default(""),
});

const ResolveSchema = z.object({
  request_id: z.string().uuid("Invalid request ID format."),
  action: z.enum(["accept", "reject"]),
});

export const POST = apiHandler({ requireAuth: true, schema: JoinRequestSchema }, async ({ params, user, body }) => {
  const { id: eventId, teamId } = params as { id: string; teamId: string };
  const supabase = await createServerClient();

  // Verify event is in TeamFormation
  const { data: event } = await supabase
    .from("events")
    .select("state")
    .eq("id", eventId)
    .single();

  if (!event || event.state !== "TeamFormationLocked") {
    return Response.json(
      { error: { code: "CONFLICT", message: "Team joining is only available during TeamFormation phase." } },
      { status: 409 },
    );
  }

  // Verify team exists and belongs to this event
  const { data: team } = await supabase
    .from("teams")
    .select("id, captain_id")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .single();

  if (!team) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Team not found." } },
      { status: 404 },
    );
  }

  const { data: joinReq, error: insertError } = await supabase
    .from("team_join_requests")
    .insert({
      team_id: teamId,
      user_id: user!.id,
      message: body.message,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return Response.json(
        { error: { code: "CONFLICT", message: "You already have a pending request for this team." } },
        { status: 409 },
      );
    }
    throw insertError;
  }

  return okResponse(joinReq);
});

export const PATCH = apiHandler({ requireAuth: true, schema: ResolveSchema }, async ({ params, user, body }) => {
  const { id: eventId, teamId } = params as { id: string; teamId: string };
  await CompetitionEngine.resolveJoinRequest(eventId, teamId, body.request_id, body.action, user!.id);
  return okResponse({ status: body.action === "accept" ? "accepted" : "rejected" });
});
