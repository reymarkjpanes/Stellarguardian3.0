/**
 * POST /api/workspaces — Create a new workspace (Req 24).
 * GET  /api/workspaces — List workspaces for the current user.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .min(2)
    .max(60),
  description: z.string().max(2000).optional(),
});

import { createWorkspace } from "@/lib/services/workspace";
import { ConflictError, BadRequestError } from "@/lib/errors";

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const parsed = CreateWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input.",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { name, slug, description } = parsed.data;

  try {
    const workspace = await createWorkspace({
      creatorId: user.id,
      name,
      slug,
      description,
    });
    return NextResponse.json({ data: workspace }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: error.message } },
        { status: 409 },
      );
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to create workspace.",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET() {
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
