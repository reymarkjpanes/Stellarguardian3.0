import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/errors/responses";

/**
 * GET /api/events/[id]/members — cursor-paginated list of Event Members
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerClient();
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
    const role = url.searchParams.get("role");
    const availability = url.searchParams.get("availability");
    const search = url.searchParams.get("search");

    let query = supabase
      .from("event_members")
      .select("*, users!inner(*, user_skills(*, skills(*)), user_links(*), user_presence(*), wallets(id)), team_memberships(team_id)", { count: "exact" })
      .eq("event_id", eventId)
      .order("id")
      .limit(limit);

    if (role) query = query.eq("role", role);
    if (availability) query = query.eq("availability", availability);
    if (cursor) query = query.gt("id", cursor);

    const { data, error, count } = await query;

    if (error) {
      return Response.json(
        { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch members." } },
        { status: 500 },
      );
    }

    let members = data ?? [];

    // Filter by search term on displayName or email in memory.
    if (search) {
      const searchLower = search.toLowerCase();
      members = members.filter(m => 
        (m.users?.display_name?.toLowerCase() ?? "").includes(searchLower) ||
        (m.users?.email?.toLowerCase() ?? "").includes(searchLower)
      );
    }

    const mappedMembers = members.map(m => {
      const u = m.users;
      const missingFields: string[] = [];
      if (!u?.wallets || u.wallets.length === 0) missingFields.push("Wallet");
      if (!u?.user_links?.some((l: any) => l.type === "GitHub")) missingFields.push("GitHub");
      if (!u?.bio) missingFields.push("Bio");
      if (!u?.avatar_url) missingFields.push("Avatar");
      if (!u?.user_skills || u.user_skills.length === 0) missingFields.push("Skills");
      if (!u?.timezone) missingFields.push("Timezone");
      if (!u?.user_links?.some((l: any) => l.type === "Portfolio")) missingFields.push("Portfolio");

      return {
        ...m,
        profileMissing: missingFields,
        inTeam: m.team_memberships && m.team_memberships.length > 0,
        teamId: m.team_memberships?.[0]?.team_id ?? null,
        team_memberships: undefined, // remove raw relational data
      };
    });

    const hasMore = members.length === limit;
    const nextCursor = hasMore ? members[members.length - 1]?.id : null;

    return paginatedResponse(mappedMembers, { cursor: nextCursor, hasMore, total: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
