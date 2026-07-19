/**
 * POST /api/events — Create a new event (Req 12).
 * GET  /api/events — List events (with workspace filter).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateEventSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  category: z.string().min(1),
  format: z.string().min(1),
  tags: z.array(z.string()).default([]),
  team_size_min: z.number().int().min(1).default(1),
  team_size_max: z.number().int().min(1).default(5),
  registration_deadline: z.string().datetime().optional(),
  prize_pool_target: z.number().min(0).optional(),
  network_mode: z.enum(["testnet", "mainnet"]).default("testnet"),
  review_window_hours: z.number().int().min(24).max(168).default(72),
  resubmission_policy: z.object({ allowed: z.boolean() }).default({ allowed: true }),
  file_policy: z.object({ allowedMimeTypes: z.array(z.string()) }).default({ allowedMimeTypes: [] }),
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
  const parsed = CreateEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const eventData = parsed.data;

  // Verify user is Owner/Admin of the workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", eventData.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role === "Member") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only workspace Owner/Admin can create events." } },
      { status: 403 },
    );
  }

  // Create event in Draft state
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      ...eventData,
      organizer_id: user.id,
      state: "Draft",
      registration_deadline: eventData.registration_deadline ?? null,
      prize_pool_target: eventData.prize_pool_target ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  // Add creator as event Organizer member
  await supabase
    .from("event_members")
    .insert({ event_id: event.id, user_id: user.id, role: "Organizer", status: "accepted" });

  return NextResponse.json({ data: event }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get("workspace_id");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data: events, count, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: events ?? [],
    meta: { total: count ?? 0, limit, offset },
  });
}
