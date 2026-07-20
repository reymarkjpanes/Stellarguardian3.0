import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { EventMemberRoleSchema, AvailabilitySchema } from "@/types/event";

const UpdateMemberSchema = z.object({
  role: EventMemberRoleSchema.optional(),
  availability: z.enum(["Open to Join Team", "Not Looking"]).optional(),
  skills: z.array(z.string()).optional(),
  timezone: z.string().nullable().optional(),
});

/**
 * PATCH /api/events/[id]/members/[memberId] — Update a member's role or status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id: eventId, memberId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdateMemberSchema.safeParse(body);

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

    // Role updates require Organizer permission.
    // Self-updates (availability, skills, timezone) are allowed.
    if (parsed.data.role) {
      const { data: callerMembership } = await supabase
        .from("event_members")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .eq("role", "Organizer")
        .maybeSingle();

      if (!callerMembership) {
        return Response.json({ error: { code: "FORBIDDEN", message: "Only organizers can change roles." } }, { status: 403 });
      }
    } else {
      // Ensure the user is modifying themselves if they aren't updating a role.
      // Or they are an organizer.
      const { data: targetMember } = await supabase
        .from("event_members")
        .select("user_id")
        .eq("id", memberId)
        .maybeSingle();
      
      if (!targetMember) {
         return Response.json({ error: { code: "NOT_FOUND", message: "Member not found." } }, { status: 404 });
      }

      if (targetMember.user_id !== user.id) {
         // Check if organizer
         const { data: callerMembership } = await supabase
            .from("event_members")
            .select("role")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .eq("role", "Organizer")
            .maybeSingle();
         if (!callerMembership) {
             return Response.json({ error: { code: "FORBIDDEN", message: "Cannot edit other members' details." } }, { status: 403 });
         }
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("event_members")
      .update(parsed.data)
      .eq("id", memberId)
      .eq("event_id", eventId)
      .select()
      .maybeSingle();

    if (updateError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: updateError.message } },
        { status: 500 },
      );
    }

    if (!updated) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Member not found." } },
        { status: 404 },
      );
    }

    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/events/[id]/members/[memberId] — Remove a member from the event.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id: eventId, memberId } = await params;
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
        { error: { code: "FORBIDDEN", message: "Only organizers can remove members." } },
        { status: 403 },
      );
    }

    // Check if trying to remove another organizer
    const { data: targetMember } = await supabase
       .from("event_members")
       .select("role")
       .eq("id", memberId)
       .maybeSingle();
       
    if (targetMember && targetMember.role === "Organizer" && user.id !== memberId) {
        return Response.json(
            { error: { code: "FORBIDDEN", message: "Cannot remove another organizer." } },
            { status: 403 },
          );
    }

    const { error: deleteError } = await supabase
      .from("event_members")
      .delete()
      .eq("id", memberId)
      .eq("event_id", eventId);

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
