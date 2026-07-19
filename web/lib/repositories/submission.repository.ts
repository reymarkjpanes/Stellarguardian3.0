import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export class SubmissionRepository {
  
  static async submitProject(
    eventId: string,
    teamId: string | null,
    submitterId: string,
    title: string,
    description: string,
    projectUrl?: string
  ): Promise<{ submissionId: string; version: number }> {
    const supabase = createServiceClient();
    
    // The RPC returns the submission ID. We know the version is updated atomically.
    // In a full implementation, the RPC could return a composite type with both, 
    // but for now we'll fetch the current version right after or let the RPC return just the ID.
    const { data, error } = await supabase.rpc("submit_project_with_version", {
      p_event_id: eventId,
      p_team_id: teamId,
      p_submitter_id: submitterId,
      p_title: title,
      p_description: description,
      p_project_url: projectUrl || null
    });
    
    if (error) {
      if (error.message.includes("Submissions are not open")) {
        throw new Error("SUBMISSIONS_CLOSED");
      }
      throw error;
    }
    
    // Fetch the version we just created/updated to return it
    const { data: subData } = await supabase
      .from("submissions")
      .select("current_version")
      .eq("id", data)
      .single();
      
    return { 
      submissionId: data as string, 
      version: subData?.current_version ?? 1 
    };
  }
}
