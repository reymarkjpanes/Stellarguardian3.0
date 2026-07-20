import { NextRequest, NextResponse } from "next/server";
import { GetSubmissionHubQueryHandler } from "@/src/domains/submissions/application/queries/GetSubmissionHubQueryHandler";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A real implementation would query the team to get the eventId
    const { data: team } = await supabase.from("teams").select("event_id").eq("id", teamId).single();
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const query = new GetSubmissionHubQueryHandler();
    const result = await query.execute(team.event_id, teamId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { UpdateDraftUseCase } from "@/src/domains/submissions/application/commands/UpdateDraftUseCase";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, requirementId, assetData } = body;

    const command = new UpdateDraftUseCase();
    const result = await command.execute(eventId, teamId, user.id, requirementId, assetData);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
