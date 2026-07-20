import { createServerClient } from "@/lib/supabase/server";
import { SubmissionStates } from "@packages/shared-kernel/constants/SubmissionStates";
import { DraftUpdated } from "@packages/shared-kernel/events/SubmissionEvents";

export class UpdateDraftUseCase {
  async execute(eventId: string, teamId: string, actorId: string, requirementId: string, assetData: any) {
    const supabase = await createServerClient();

    // 1. Get or Create Submission (Lazy initialization on first draft edit)
    let { data: submission } = await supabase
      .from("submissions")
      .select("*")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!submission) {
      const { data: newSub, error } = await supabase
        .from("submissions")
        .insert({
          team_id: teamId,
          event_id: eventId,
          status: SubmissionStates.DRAFT,
          version: 1
        })
        .select()
        .single();
        
      if (error) throw new Error("Failed to initialize submission draft");
      submission = newSub;
    }

    // 2. State Check
    if (submission.status === SubmissionStates.LOCKED || submission.status === SubmissionStates.SUBMITTED) {
      throw new Error("Cannot edit a locked or submitted project");
    }

    // 3. Upsert Asset
    const { error: assetError } = await supabase
      .from("submission_assets")
      .upsert({
        submission_id: submission.id,
        requirement_id: requirementId,
        asset_type: assetData.assetType,
        text_value: assetData.textValue || null,
        url_value: assetData.urlValue || null,
        storage_path: assetData.storagePath || null,
        metadata: assetData.metadata || null
      }, { onConflict: 'submission_id, requirement_id' });

    if (assetError) throw new Error("Failed to save asset");

    // 4. Bump version
    const newVersion = submission.version + 1;
    await supabase.from("submissions").update({ version: newVersion, status: SubmissionStates.DRAFT }).eq("id", submission.id);

    // 5. Save History & Event
    await supabase.from("submission_history").insert({
      submission_id: submission.id,
      actor_id: actorId,
      action: "DRAFT_UPDATED",
      details: "Asset updated"
    });

    const event = new DraftUpdated(submission.id, newVersion);
    await supabase.from("submission_events").insert({
      submission_id: submission.id,
      event_type: event.eventName,
      payload: event
    });

    return { success: true, version: newVersion };
  }
}
