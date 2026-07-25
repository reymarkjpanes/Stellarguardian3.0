import "server-only";
import { SubmissionRepository } from "@/lib/repositories/submission.repository";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

export class SubmissionService {
  static async submitProject(
    eventId: string,
    submitterId: string,
    payload: { title: string; description: string; projectUrl?: string },
  ): Promise<{ submissionId: string; teamId: string | null; version: number }> {
    const supabase = await createServerClient();

    // Verify participant role
    const { data: membership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", submitterId)
      .ilike("role", "participant")
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenError("Only accepted participants can submit.");
    }

    // Check if user has a team in this event
    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("team_id, teams!inner(event_id)")
      .eq("user_id", submitterId)
      .maybeSingle();

    let teamId: string | null = null;
    if (teamMembership) {
      const teamEvent = (teamMembership as { team_id: string; teams: { event_id: string } | null })
        .teams;
      if (teamEvent?.event_id === eventId) {
        teamId = teamMembership.team_id;
      }
    }

    try {
      const result = await SubmissionRepository.submitProject(
        eventId,
        teamId,
        submitterId,
        payload.title,
        payload.description,
        payload.projectUrl,
      );

      return { ...result, teamId };
    } catch (error) {
      if (error instanceof Error && error.message === "SUBMISSIONS_CLOSED") {
        throw new ConflictError("Submissions are not currently open for this event.");
      }
      throw error;
    }
  }
}
