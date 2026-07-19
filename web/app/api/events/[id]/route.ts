/**
 * Event detail endpoint (Req 12.3, 12.4).
 *
 * GET /api/events/[id] — returns the event itself (not all sub-resources)
 * PATCH /api/events/[id] — update event (with optimistic concurrency)
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { optimisticUpdate } from "@/lib/services/concurrency";
import { writeAuditRecord } from "@/lib/services/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error || !data) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Event not found." } },
        { status: 404 },
      );
    }

    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
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

    const body = await request.json();
    const { version, ...updates } = body;

    if (version === undefined) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Version field is required for updates (Req 19.2)." } },
        { status: 400 },
      );
    }

    const data = await optimisticUpdate(supabase, "events", eventId, version, updates);

    await writeAuditRecord({
      action: "event.update",
      actor_id: user.id,
      event_id: eventId,
      resource_type: "events",
      resource_id: eventId,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
