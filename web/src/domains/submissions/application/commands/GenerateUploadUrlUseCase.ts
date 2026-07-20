import { createServerClient } from "@/lib/supabase/server";

export class GenerateUploadUrlUseCase {
  async execute(eventId: string, teamId: string, actorId: string, filename: string, contentType: string) {
    const supabase = await createServerClient();

    // Verification: ensure the actor is a member of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", actorId)
      .maybeSingle();

    if (!membership) {
      throw new Error("Unauthorized: Not a member of this team.");
    }

    // Determine safe file path
    const extension = filename.split('.').pop() || '';
    const safeFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const storagePath = `submissions/${eventId}/${teamId}/${safeFilename}`;

    // Create Presigned URL (using Supabase Storage)
    const { data, error } = await supabase
      .storage
      .from('hackathon-assets')
      .createSignedUploadUrl(storagePath);

    if (error) {
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }

    return {
      signedUrl: data.signedUrl,
      path: storagePath,
      token: data.token,
    };
  }
}
