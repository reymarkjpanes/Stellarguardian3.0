/**
 * GET /api/events/[id]/milestones — List event milestones.
 * POST /api/events/[id]/milestones — Create a milestone (organizer only).
 * PATCH /api/events/[id]/milestones — Update milestone status.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  due_date: z.string().datetime().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
});

const UpdateMilestoneSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("event_id", id)
    .order("due_date", { ascending: true });

  return NextResponse.json({ data: milestones ?? [] });
}

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

  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "Organizer") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only organizers can create milestones." } },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = CreateMilestoneSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { data: milestone, error } = await supabase
    .from("milestones")
    .insert({
      event_id: id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      due_date: parsed.data.due_date ?? null,
      status: parsed.data.status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: milestone }, { status: 201 });
}

export async function PATCH(
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

  const body = await request.json();
  const parsed = UpdateMilestoneSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input." } },
      { status: 422 },
    );
  }

  const { data: updated, error } = await supabase
    .from("milestones")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("event_id", id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Milestone not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: updated });
}
