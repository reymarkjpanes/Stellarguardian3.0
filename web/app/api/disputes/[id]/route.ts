/**
 * PATCH /api/disputes/[id] — Resolve a dispute (transition state).
 *
 * Only event organizers or platform admins can resolve disputes.
 * Valid transitions: Open/UnderReview → Upheld | Dismissed | Escalated
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const ResolveSchema = z.object({
  state: z.enum(["UnderReview", "Upheld", "Dismissed", "Escalated"]),
});
export const PATCH = withErrorHandling(async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: disputeId } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Get the dispute and its event
    const { data: dispute } = await supabase
      .from("disputes")
      .select("id, event_id, state")
      .eq("id", disputeId)
      .single();

    if (!dispute) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Dispute not found." } },
        { status: 404 },
      );
    }

    // Verify caller is organizer of the event
    const { data: membership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", dispute.event_id)
      .eq("user_id", user.id)
      .eq("role", "Organizer")
      .maybeSingle();

    if (!membership) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only event organizers can resolve disputes." } },
        { status: 403 },
      );
    }

    // Validate state transition
    const validFromStates = ["Open", "UnderReview"];
    if (!validFromStates.includes(dispute.state)) {
      return Response.json(
        {
          error: {
            code: "CONFLICT",
            message: `Cannot resolve dispute in state: ${dispute.state}.`,
          },
        },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = ResolveSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid resolution state." } },
        { status: 422 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("disputes")
      .update({
        state: parsed.data.state,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", disputeId)
      .select()
      .single();

    if (updateError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: updateError.message } },
        { status: 500 },
      );
    }

    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
});
