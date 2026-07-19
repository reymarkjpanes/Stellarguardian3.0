/**
 * POST /api/workspaces — Create a new workspace (Req 24).
 * GET  /api/workspaces — List workspaces for the current user.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(2).max(60),
  description: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = CreateWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { name, slug, description } = parsed.data;

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "A workspace with this slug already exists." } },
      { status: 409 },
    );
  }

  // Create workspace + owner membership atomically
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name, slug, description: description ?? null })
    .select()
    .single();

  if (wsError) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: wsError.message } },
      { status: 500 },
    );
  }

  // Add creator as Owner
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "Owner" });

  if (memberError) {
    // Rollback workspace on member creation failure
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: memberError.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: workspace }, { status: 201 });
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ data: [], meta: { total: 0 } });
  }

  const ids = memberships.map((m) => m.workspace_id);
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });

  const enriched = (workspaces ?? []).map((ws) => ({
    ...ws,
    role: memberships.find((m) => m.workspace_id === ws.id)?.role ?? "Member",
  }));

  return NextResponse.json({ data: enriched, meta: { total: enriched.length } });
}
