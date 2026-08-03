/**
 * POST /api/events/[id]/self-assign-judge
 *
 * Lets an event organizer assign themselves as a Judge without navigating
 * to the members management page. Uses the `organizer_self_assign_judge`
 * SECURITY DEFINER RPC so the insert bypasses event_members RLS policies
 * (which lack an UPDATE policy and can fail on the post-INSERT SELECT
 * visibility check).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const POST = withErrorHandling(async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { data, error } = await supabase.rpc("organizer_self_assign_judge", {
    p_event_id: eventId,
  });

  if (error) {
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  const result = data as { success: boolean; error?: string };

  if (!result?.success) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: result?.error ?? "Failed to assign yourself as judge." } },
      { status: 403 },
    );
  }

  return NextResponse.json({ data: { success: true } });
});
