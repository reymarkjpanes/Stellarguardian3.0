import { createServerClient } from "@/lib/supabase/server";

export class GetSubmissionHubQueryHandler {
  async execute(eventId: string, teamId: string) {
    const supabase = await createServerClient();

    // 1. Fetch requirements for the event
    const { data: requirements, error: reqError } = await supabase
      .from("submission_requirements")
      .select("*")
      .eq("event_id", eventId);

    if (reqError) throw new Error("Failed to fetch requirements");

    // 2. Fetch the submission state
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (subError) throw new Error("Failed to fetch submission");

    // 3. If there's a submission, fetch its assets
    let assets: Record<string, unknown>[] = [];
    if (submission) {
      const { data: assetData, error: assetError } = await supabase
        .from("submission_assets")
        .select("*")
        .eq("submission_id", submission.id);

      if (assetError) throw new Error("Failed to fetch assets");
      assets = (assetData ?? []) as Record<string, unknown>[];
    }

    return {
      submission: submission || null,
      requirements: requirements || [],
      assets: assets,
    };
  }
}
