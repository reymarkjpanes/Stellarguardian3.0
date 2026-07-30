import { createServerClient } from "@/lib/supabase/server";
import { SubmissionStates } from "@packages/shared-kernel/constants/SubmissionStates";
import { SubmissionReopened } from "@packages/shared-kernel/events/SubmissionEvents";

export class UnsubmitProjectUseCase {
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
    if (submission.status === SubmissionStates.LOCKED) {
      throw new Error("Submission is locked by an admin and cannot be unsubmitted");
    }

    if (submission.status !== SubmissionStates.SUBMITTED) {
      throw new Error("Submission is not in submitted state");
    }

    // 3. Verify actor is captain
    const { data: team } = await supabase
      .from("teams")
      .select("captain_id")
      .eq("id", teamId)
      .single();

    if (team?.captain_id !== actorId) {
      throw new Error("Only the Captain can unsubmit the project");
    }

    // 4. Update submission state
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: SubmissionStates.DRAFT,
        version: submission.version + 1,
      })
      .eq("id", submission.id)
      .eq("version", submission.version);

    if (updateError) {
      throw new Error("Concurrency conflict or update failed");
    }

    // 5. Log History
    await supabase.from("submission_history").insert({
      submission_id: submission.id,
      actor_id: actorId,
      action: "UNSUBMITTED",
      details: "Project unsubmitted by captain for editing",
    });

    // 6. Domain Event
    const event = new SubmissionReopened(submission.id);
    await supabase.from("submission_events").insert({
      submission_id: submission.id,
      event_type: event.eventName,
      payload: event,
    });

    return { success: true };
  }
}
