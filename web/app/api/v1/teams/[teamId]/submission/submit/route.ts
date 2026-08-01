import { NextRequest, NextResponse } from "next/server";
import { SubmitProjectUseCase } from "@/src/domains/submissions/application/commands/SubmitProjectUseCase";
import { createServerClient } from "@/lib/supabase/server";
import { SaveSubmissionPayloadSchema } from "@/types/submission";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const POST = withErrorHandling(async function POST(
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
    const parsed = SaveSubmissionPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const { eventId, status, ...fields } = data;

    // Check if submission exists
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
          ...fields,
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSub.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("submissions").insert({
        team_id: teamId,
        event_id: eventId,
        submitter_id: user.id,
        status: status,
        current_version: 1,
        version: 1,
        ...fields,
      });

      if (insertError) throw insertError;
    }

    // Also run original domain logic for actual "Submitted" state transition if needed
    // But since we just updated the status directly, we might trigger SubmitProjectUseCase for domain events
    if (status === "Submitted") {
      try {
        const command = new SubmitProjectUseCase();
        await command.execute(eventId, teamId, user.id);
      } catch (err) {
        // If domain validation fails (e.g. missing assets), we might want to revert or just surface the error
        const msg = err instanceof Error ? err.message : String(err);
        // Revert status to Draft
        if (existingSub) {
          await supabase.from("submissions").update({ status: "Draft" }).eq("id", existingSub.id);
        } else {
          await supabase
            .from("submissions")
            .update({ status: "Draft" })
            .eq("team_id", teamId)
            .eq("event_id", eventId);
        }
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
});
