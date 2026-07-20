import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";

const UpdateInvitationSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

/**
 * PATCH /api/events/[id]/invitations/[invitationId] — Accept or decline an invitation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  try {
    const { id: eventId, invitationId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdateInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid request body.",
            details: { fieldErrors: z.flattenError(parsed.error).fieldErrors },
          },
        },
        { status: 422 },
      );
    }

    // Fetch the invitation
    const { data: invitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("scope", "event")
      .eq("scope_id", eventId)
      .maybeSingle();

    if (!invitation) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Invitation not found." } }, { status: 404 });
    }

    if (invitation.invitee_email !== user.email) {
       return Response.json({ error: { code: "FORBIDDEN", message: "This invitation is not for you." } }, { status: 403 });
    }
    
    if (invitation.accepted_at) {
       return Response.json({ error: { code: "CONFLICT", message: "Invitation already accepted." } }, { status: 409 });
    }

    if (parsed.data.action === "accept") {
      // Create Event Member
      const { error: insertError } = await supabase.from("event_members").insert({
        event_id: eventId,
        user_id: user.id,
        role: "Participant", // Default role for invited members, or maybe should read from invitation metadata
        availability: "Not Looking"
      });
      
      if (insertError) {
         return Response.json({ error: { code: "INTERNAL_SERVER_ERROR", message: insertError.message } }, { status: 500 });
      }

      // Mark invitation accepted
      await supabase.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitationId);
    } else {
      // Decline: delete the invitation or mark it declined
      await supabase.from("invitations").delete().eq("id", invitationId);
    }

    return okResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/events/[id]/invitations/[invitationId] — Cancel an invitation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  try {
    const { id: eventId, invitationId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, { status: 401 });
    }

    // Verify caller is organizer
    const { data: callerMembership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("role", "Organizer")
      .maybeSingle();

    if (!callerMembership) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only organizers can manage invitations." } },
        { status: 403 },
      );
    }

    const { error: deleteError } = await supabase
      .from("invitations")
      .delete()
      .eq("id", invitationId)
      .eq("scope_id", eventId)
      .eq("scope", "event");

    if (deleteError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: deleteError.message } },
        { status: 500 },
      );
    }

    return okResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
