/**
 * Event Export — M12
 *
 * GET /api/events/[id]/export?type=participants|submissions|winners
 * Returns CSV data. Organizer-only.
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // Verify organizer
    const { data: membership } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("role", "Organizer")
      .maybeSingle();

    if (!membership) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only organizers can export data." } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "participants";

    let csv = "";
    let filename = "";

    switch (type) {
      case "participants": {
        const { data: members } = await supabase
          .from("event_members")
          .select("user_id, role, status, users!inner(display_name, email)")
          .eq("event_id", eventId);

        csv = "user_id,display_name,email,role,status\n";
        for (const m of members ?? []) {
          const u = m.users as unknown as { display_name: string; email: string };
          csv += `${m.user_id},"${u.display_name ?? ""}","${u.email ?? ""}",${m.role},${m.status}\n`;
        }
        filename = `participants-${eventId.slice(0, 8)}.csv`;
        break;
      }

      case "submissions": {
        const { data: subs } = await supabase
          .from("submissions")
          .select("id, submitter_id, team_id, status, current_version, content, created_at")
          .eq("event_id", eventId);

        csv = "submission_id,submitter_id,team_id,status,version,title,created_at\n";
        for (const s of subs ?? []) {
          const content = s.content as Record<string, unknown> | null;
          const title = content?.title ?? "";
          csv += `${s.id},${s.submitter_id},${s.team_id ?? ""},${s.status},${s.current_version},"${title}",${s.created_at}\n`;
        }
        filename = `submissions-${eventId.slice(0, 8)}.csv`;
        break;
      }

      case "winners": {
        const { data: winners } = await supabase
          .from("winners")
          .select("id, recipient_id, team_id, prize_amount, disbursement_status, disbursement_tx_hash")
          .eq("event_id", eventId)
          .order("prize_amount", { ascending: false });

        csv = "winner_id,recipient_id,team_id,prize_amount,disbursement_status,tx_hash\n";
        for (const w of winners ?? []) {
          csv += `${w.id},${w.recipient_id},${w.team_id ?? ""},${w.prize_amount},${w.disbursement_status},${w.disbursement_tx_hash ?? ""}\n`;
        }
        filename = `winners-${eventId.slice(0, 8)}.csv`;
        break;
      }

      default:
        return Response.json(
          { error: { code: "BAD_REQUEST", message: "Invalid export type. Use: participants, submissions, or winners." } },
          { status: 400 },
        );
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
