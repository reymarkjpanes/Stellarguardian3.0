import { NextRequest, NextResponse } from "next/server";
import { SubmitProjectUseCase } from "@/src/domains/submissions/application/commands/SubmitProjectUseCase";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId } = body;

    const command = new SubmitProjectUseCase();
    const result = await command.execute(eventId, teamId, user.id);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
