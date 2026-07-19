/**
 * Evaluation Criteria (Judging Rubrics) — M3
 *
 * GET  /api/events/[id]/criteria — list criteria for event
 * POST /api/events/[id]/criteria — add a criterion (organizer only)
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";

const CreateCriterionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  max_score: z.number().int().min(1).max(1000).default(100),
  weight: z.number().positive().default(1.0),
  sort_order: z.number().int().default(0),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("evaluation_criteria")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: error.message } },
        { status: 500 },
      );
    }

    return okResponse(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Verify organizer
    const { data: membership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("role", "Organizer")
      .maybeSingle();

    if (!membership) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only organizers can manage criteria." } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateCriterionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid input.", details: { fieldErrors: z.flattenError(parsed.error).fieldErrors } } },
        { status: 422 },
      );
    }

    const { data: criterion, error: insertError } = await supabase
      .from("evaluation_criteria")
      .insert({ event_id: eventId, ...parsed.data })
      .select()
      .single();

    if (insertError) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: insertError.message } },
        { status: 500 },
      );
    }

    return okResponse(criterion);
  } catch (error) {
    return handleApiError(error);
  }
}
