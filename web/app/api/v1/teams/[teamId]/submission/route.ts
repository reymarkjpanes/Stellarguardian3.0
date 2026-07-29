import { NextRequest, NextResponse } from "next/server";
import { GetSubmissionHubQueryHandler } from "@/src/domains/submissions/application/queries/GetSubmissionHubQueryHandler";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
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
      .select("event_id, captain_id")
      .eq("id", teamId)
      .single();
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const query = new GetSubmissionHubQueryHandler();
    const result = await query.execute(team.event_id, teamId);

    return NextResponse.json({
      success: true,
      data: { ...result, isCaptain: team.captain_id === user.id },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

import { UpdateDraftUseCase } from "@/src/domains/submissions/application/commands/UpdateDraftUseCase";

export async function PATCH(
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

    const body = await request.json();
    const { eventId, requirementId, assetData } = body;

    const command = new UpdateDraftUseCase();
    const result = await command.execute(eventId, teamId, user.id, requirementId, assetData);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(
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

    const body = await request.json();
    const { eventId, requirementId } = body;

    // Very simple inline logic for deletion since there's no RemoveAssetUseCase
    const { data: submission } = await supabase
      .from("submissions")
      .select("id, status")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.status === "LOCKED" || submission.status === "SUBMITTED") {
      throw new Error("Cannot modify a locked or submitted project");
    }

    const { error: deleteError } = await supabase
      .from("submission_assets")
      .delete()
      .eq("submission_id", submission.id)
      .eq("requirement_id", requirementId);

    if (deleteError) {
      throw new Error("Failed to delete asset");
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
