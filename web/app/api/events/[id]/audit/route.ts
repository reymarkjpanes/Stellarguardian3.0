/**
 * GET /api/events/[id]/audit — Audit trail for a specific event (Req 31).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  // Only organizer/admin can view audit trail
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role === "Participant") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only organizers can view audit trail." } },
      { status: 403 },
    );
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const { data: records, count } = await supabase
    .from("audit_records")
    .select("*", { count: "exact" })
    .eq("resource_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    data: records ?? [],
    meta: { total: count ?? 0, limit, offset },
  });
}
