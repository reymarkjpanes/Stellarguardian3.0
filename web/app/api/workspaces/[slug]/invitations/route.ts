/**
 * POST /api/workspaces/[slug]/invitations — Create an invitation.
 * GET  /api/workspaces/[slug]/invitations — List pending invitations.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["Admin", "Member"]).default("Member"),
});

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

  // Verify caller is Owner/Admin
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerMembership || callerMembership.role === "Member") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only Owner/Admin can send invitations." } },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = CreateInvitationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { email, role } = parsed.data;

  // Create invitation record
  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      workspace_id: workspace.id,
      email,
      role,
      invited_by: user.id,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "An invitation for this email already exists." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: invitation }, { status: 201 });
}

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

  const { data: invitations } = await supabase
    .from("invitations")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ data: invitations ?? [] });
}
