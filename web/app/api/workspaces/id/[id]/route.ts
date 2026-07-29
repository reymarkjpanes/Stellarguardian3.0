/**
 * GET  /api/workspaces/id/[id] — Fetch workspace by UUID (slug-agnostic).
 * PATCH /api/workspaces/id/[id] — Update workspace by UUID, supports setting slug.
 *
 * Fallback for workspaces created before slug generation was enforced.
 * Once a slug is set, the canonical /api/workspaces/[slug] route should be used.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateByIdSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only")
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single();

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ data: { ...workspace, currentUserRole: membership.role } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, version")
    .eq("id", id)
    .single();

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["Owner", "Admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = UpdateByIdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const updates: Record<string, unknown> = { version: workspace.version + 1 };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.slug) updates.slug = parsed.data.slug;

  const { data: updated, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", id)
    .eq("version", workspace.version)
    .select("id, slug, name")
    .single();

  if (error || !updated) {
    const isDupe = error?.code === "23505";
    return NextResponse.json(
      { error: isDupe ? "A workspace with this slug already exists." : "Update failed." },
      { status: isDupe ? 409 : 500 },
    );
  }

  return NextResponse.json({ data: updated });
}
