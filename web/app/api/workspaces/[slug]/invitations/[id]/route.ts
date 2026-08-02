/**
 * DELETE /api/workspaces/[slug]/invitations/[id] — Revoke a pending invitation.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

export const DELETE = withErrorHandling(async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Verify caller is Owner/Admin
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerMembership || callerMembership.role === "Member") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only Owner/Admin can revoke invitations." } },
      { status: 403 },
    );
  }

  // Delete the invitation — ensure it belongs to this workspace
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 204 });
});
