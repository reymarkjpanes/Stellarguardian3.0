/**
 * GET /api/workspaces/[slug]/members — List workspace members.
 * POST /api/workspaces/[slug]/members — Invite/add a member.
 * DELETE /api/workspaces/[slug]/members — Remove a member.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const AddMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["Admin", "Member"]),
});

const RemoveMemberSchema = z.object({
  user_id: z.string().uuid(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!workspace) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Workspace not found." } },
      { status: 404 },
    );
  }

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspace.id);

  // Enrich with user display names
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: users } = userIds.length > 0
    ? await supabase.from("users").select("id, display_name, email").in("id", userIds)
    : { data: [] };

  const usersMap = new Map((users ?? []).map((u) => [u.id, u]));

  const enriched = (members ?? []).map((m) => ({
    ...m,
    display_name: usersMap.get(m.user_id)?.display_name ?? "Unknown",
    email: usersMap.get(m.user_id)?.email ?? "",
  }));

  return NextResponse.json({ data: enriched });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!workspace) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Workspace not found." } },
      { status: 404 },
    );
  }

  // Check caller is Owner/Admin
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerMembership || callerMembership.role === "Member") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only Owner/Admin can manage members." } },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = AddMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { user_id, role } = parsed.data;

  const { error } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id, role });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "User is already a member of this workspace." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { user_id, role } }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!workspace) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Workspace not found." } },
      { status: 404 },
    );
  }

  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerMembership || callerMembership.role === "Member") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only Owner/Admin can remove members." } },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = RemoveMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input." } },
      { status: 422 },
    );
  }

  // Cannot remove the Owner
  const { data: targetMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", parsed.data.user_id)
    .maybeSingle();

  if (targetMembership?.role === "Owner") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Cannot remove the workspace Owner." } },
      { status: 403 },
    );
  }

  await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", parsed.data.user_id);

  return NextResponse.json({ data: { removed: parsed.data.user_id } });
}
