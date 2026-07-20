import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse, paginatedResponse } from "@/lib/errors/responses";

/**
 * GET /api/events/[id]/invitations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

    let query = supabase
      .from("invitations")
      .select("*", { count: "exact" })
      .eq("scope", "event")
      .eq("scope_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt("created_at", cursor); // cursor is a timestamp for descending order
    }

    const { data, error, count } = await query;

    if (error) {
       return Response.json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch invitations." } }, { status: 500 });
    }

    const invitations = data ?? [];
    const hasMore = invitations.length === limit;
    const nextCursor = hasMore ? invitations[invitations.length - 1]?.created_at : null;

    return paginatedResponse(invitations, { cursor: nextCursor, hasMore, total: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreateEventInvitationSchema = z.object({
  inviteeEmail: z.string().email(),
  // optionally include a role if organizers can invite directly with a specific role
});

/**
 * POST /api/events/[id]/invitations
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
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
        { error: { code: "FORBIDDEN", message: "Only organizers can invite members." } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateEventInvitationSchema.safeParse(body);

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

    // Check if the user is already in the event
    const { data: targetUser } = await supabase.from("users").select("id").eq("email", parsed.data.inviteeEmail).maybeSingle();
    
    if (targetUser) {
        const { data: existingMember } = await supabase
            .from("event_members")
            .select("id")
            .eq("event_id", eventId)
            .eq("user_id", targetUser.id)
            .maybeSingle();
            
        if (existingMember) {
            return Response.json(
              { error: { code: "CONFLICT", message: "User is already an event member." } },
              { status: 409 },
            );
        }
    }

    // Create the invitation
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert({
         scope: "event",
         scope_id: eventId,
         inviter_id: user.id,
         invitee_email: parsed.data.inviteeEmail,
         token: crypto.randomUUID(), // Simplified token generation for MVP
         expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single();

    if (insertError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: insertError.message } },
        { status: 500 },
      );
    }

    // Send email logic would go here.

    return okResponse(invitation, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
