import { createServerClient } from "@/lib/supabase/server";
import { GetValidationPanelQueryHandler } from "../queries/GetValidationPanelQueryHandler";
import { SubmissionStates } from "@packages/shared-kernel/constants/SubmissionStates";
import { SubmissionSubmitted } from "@packages/shared-kernel/events/SubmissionEvents";

export class SubmitProjectUseCase {
  constructor(private validationQuery: GetValidationPanelQueryHandler = new GetValidationPanelQueryHandler()) {}

  async execute(eventId: string, teamId: string, actorId: string) {
    const supabase = await createServerClient();

    // 1. Get current submission
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (subError || !submission) throw new Error("Submission not found");

    // 2. Validate current state
    if (submission.status === SubmissionStates.SUBMITTED || submission.status === SubmissionStates.LOCKED) {
       throw new Error("Submission is already submitted or locked");
    }

    // 3. Verify actor is captain
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", actorId)
      .maybeSingle();

    if (membership?.role !== "Captain") {
      throw new Error("Only the Captain can submit the project");
    }

    // 4. Validate requirements
    const validation = await this.validationQuery.execute(eventId, teamId);
    if (!validation.isReady) {
      throw new Error(`Submission is missing required assets: ${validation.missing.join(", ")}`);
    }

    // 5. Update submission state (Optimistic Concurrency)
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: SubmissionStates.SUBMITTED,
        submitted_at: new Date().toISOString(),
        version: submission.version + 1,
      })
      .eq("id", submission.id)
      .eq("version", submission.version); // If-Match equivalent

    if (updateError) {
       throw new Error("Concurrency conflict or update failed");
    }

    // 6. Log History
    await supabase.from("submission_history").insert({
      submission_id: submission.id,
      actor_id: actorId,
      action: "SUBMITTED",
      details: "Project submitted by captain"
    });

    // 7. Domain Event (in a real app, this goes to an EventBus/Outbox)
    const event = new SubmissionSubmitted(submission.id, new Date());
    await supabase.from("submission_events").insert({
      submission_id: submission.id,
      event_type: event.eventName,
      payload: event
    });

    return { success: true };
  }
}
