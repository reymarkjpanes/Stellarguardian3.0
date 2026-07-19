/**
 * POST /api/events/[id]/sponsors — Add a sponsor to event.
 * GET  /api/events/[id]/sponsors — List event sponsors.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const AddSponsorSchema = z.object({
  user_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  logo_url: z.string().url().optional(),
  contribution_amount: z.number().min(0).optional(),
  tier: z.enum(["platinum", "gold", "silver", "bronze"]).default("bronze"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  // Only organizer can add sponsors
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "Organizer") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only organizers can manage sponsors." } },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = AddSponsorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { data: sponsor, error } = await supabase
    .from("sponsors")
    .insert({
      event_id: id,
      user_id: parsed.data.user_id ?? null,
      name: parsed.data.name,
      logo_url: parsed.data.logo_url ?? null,
      contribution_amount: parsed.data.contribution_amount ?? 0,
      tier: parsed.data.tier,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  // Also add as event member with Sponsor role if user_id provided
  if (parsed.data.user_id) {
    await supabase.from("event_members").upsert(
      { event_id: id, user_id: parsed.data.user_id, role: "Sponsor", status: "accepted" },
      { onConflict: "event_id,user_id,role" },
    );
  }

  return NextResponse.json({ data: sponsor }, { status: 201 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("*")
    .eq("event_id", id)
    .order("tier", { ascending: true });

  return NextResponse.json({ data: sponsors ?? [] });
}
