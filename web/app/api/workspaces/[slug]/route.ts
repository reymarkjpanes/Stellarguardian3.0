/**
 * GET /api/workspaces/[slug] — Get workspace details.
 * PATCH /api/workspaces/[slug] — Update workspace settings.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  billing: z.record(z.string(), z.unknown()).optional(),
  white_label: z.record(z.string(), z.unknown()).optional(),
  feature_flags: z.record(z.string(), z.unknown()).optional(),
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
    .select("*")
    .eq("slug", slug)
    .single();

  if (!workspace) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Workspace not found." } },
      { status: 404 },
    );
  }

  // Check membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not a member of this workspace." } },
      { status: 403 },
    );
  }

  // Fetch members
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspace.id);

  return NextResponse.json({
    data: { ...workspace, currentUserRole: membership.role, members: members ?? [] },
  });
}

export async function PATCH(
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
    .select("id, version")
    .eq("slug", slug)
    .single();

  if (!workspace) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Workspace not found." } },
      { status: 404 },
    );
  }

  // Only Owner/Admin can update
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role === "Member") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only workspace Owner or Admin can update settings." } },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = UpdateWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const updates: Record<string, unknown> = { version: workspace.version + 1 };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.settings) updates.settings = parsed.data.settings;
  if (parsed.data.billing) updates.billing = parsed.data.billing;
  if (parsed.data.white_label) updates.white_label = parsed.data.white_label;
  if (parsed.data.feature_flags) updates.feature_flags = parsed.data.feature_flags;

  const { data: updated, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", workspace.id)
    .eq("version", workspace.version)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Workspace was modified concurrently. Refresh and retry." } },
      { status: 409 },
    );
  }

  return NextResponse.json({ data: updated });
}
