import { NextRequest, NextResponse } from "next/server";
import { GetValidationPanelQueryHandler } from "@/src/domains/submissions/application/queries/GetValidationPanelQueryHandler";
import { createServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const GET = withErrorHandling(async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await context.params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A real implementation would query the team to get the eventId
    const { data: team } = await supabase
      .from("teams")
      .select("event_id")
      .eq("id", teamId)
      .single();
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const query = new GetValidationPanelQueryHandler();
    const result = await query.execute(team.event_id, teamId);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
