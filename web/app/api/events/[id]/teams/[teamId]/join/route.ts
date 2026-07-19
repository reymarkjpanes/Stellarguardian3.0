/**
 * Team Join Request — M6
 *
 * POST  /api/events/[id]/teams/[teamId]/join — request to join a team
 * PATCH /api/events/[id]/teams/[teamId]/join — approve/reject (captain only)
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";

const JoinRequestSchema = z.object({
  message: z.string().max(500).default(""),
});

const ResolveSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> },
) {
  try {
    const { id: eventId, teamId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Verify event is in TeamFormation
    const { data: event } = await supabase
      .from("events")
      .select("state")
      .eq("id", eventId)
      .single();

    if (!event || event.state !== "TeamFormation") {
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

    const body = await request.json();
    const parsed = JoinRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid input." } },
        { status: 422 },
      );
    }

    const { data: joinReq, error: insertError } = await supabase
      .from("team_join_requests")
      .insert({
        team_id: teamId,
        user_id: user.id,
        message: parsed.data.message,
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
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: insertError.message } },
        { status: 500 },
      );
    }

    return okResponse(joinReq);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Verify caller is team captain
    const { data: team } = await supabase
      .from("teams")
      .select("id, captain_id")
      .eq("id", teamId)
      .single();

    if (!team || team.captain_id !== user.id) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only the team captain can manage join requests." } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = ResolveSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid input." } },
        { status: 422 },
      );
    }

    const { request_id, action } = parsed.data;
    const newStatus = action === "accept" ? "accepted" : "rejected";

    // Update request status
    const { data: updated, error: updateError } = await supabase
      .from("team_join_requests")
      .update({
        status: newStatus,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", request_id)
      .eq("team_id", teamId)
      .eq("status", "pending")
      .select("*, users!team_join_requests_user_id_fkey(id)")
      .single();

    if (updateError || !updated) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Pending request not found." } },
        { status: 404 },
      );
    }

    // If accepted, add user to team_members
    if (action === "accept") {
      await supabase.from("team_members").insert({
        team_id: teamId,
        user_id: updated.user_id,
      });
    }

    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
