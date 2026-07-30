import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  teamId: z.string(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
  title: z.string().optional().nullable(),
  short_description: z.string().optional().nullable(),
  detailed_description: z.string().optional().nullable(),
  problem_statement: z.string().optional().nullable(),
  solution_overview: z.string().optional().nullable(),
  key_features: z.string().optional().nullable(),
  tech_stack: z.array(z.string()).optional().nullable(),
  github_url: z.string().optional().nullable().or(z.literal("")),
  live_demo_url: z.string().optional().nullable().or(z.literal("")),
  video_url: z.string().optional().nullable().or(z.literal("")),
  presentation_url: z.string().optional().nullable().or(z.literal("")),
  documentation_url: z.string().optional().nullable().or(z.literal("")),
  api_docs_url: z.string().optional().nullable().or(z.literal("")),
  smart_contract_addresses: z.array(z.string()).optional().nullable(),
  blockchain_explorer_url: z.string().optional().nullable().or(z.literal("")),
  deployed_network: z.string().optional().nullable(),
  ai_models_used: z.string().optional().nullable(),
  challenges_faced: z.string().optional().nullable(),
  future_improvements: z.string().optional().nullable(),
  additional_notes: z.string().optional().nullable(),
  screenshots: z.array(z.string()).optional().nullable(),
  categories_entered: z.array(z.string()).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const data = Schema.parse(body);

    const supabase = await createServerClient();
    const { data: userRes, error: authError } = await supabase.auth.getUser();

    if (authError || !userRes.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, status, ...fields } = data;

    // Verify user is in team
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userRes.user.id)
      .single();

    if (!teamMember) {
      return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
    }

    // Format status for the DB enum (which expects Title Case)
    const dbStatus = status === "SUBMITTED" ? "Submitted" : "Draft";

    // Extra server-side safety check: if submitting, ensure required fields exist
    if (dbStatus === "Submitted") {
      if (!fields.title?.trim() || !fields.github_url?.trim()) {
        return NextResponse.json(
          { error: "Title and GitHub URL are required for final submission" },
          { status: 400 }
        );
      }
    }

    // Upsert submission manually
    const { data: existingSub } = await supabase
      .from("submissions")
      .select("id")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingSub) {
      const { error: updateError } = await supabase
        .from("submissions")
        .update({
          status: dbStatus,
          ...fields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSub.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase
        .from("submissions")
        .insert({
          team_id: teamId,
          event_id: eventId,
          submitter_id: userRes.user.id,
          status: dbStatus,
          ...fields,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Submission API error:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
