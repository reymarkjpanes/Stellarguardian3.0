/**
 * POST /api/events/[id]/register — Register as a participant (Req 10/11).
 * DELETE /api/events/[id]/register — Withdraw registration.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
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

  // Fetch event to check state
  const { data: event } = await supabase
    .from("events")
    .select("id, state, registration_deadline")
    .eq("id", id)
    .single();

  if (!event) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Event not found." } },
      { status: 404 },
    );
  }

  // Can only register during RegistrationOpen state
  if (event.state !== "RegistrationOpen") {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "Registration is not currently open for this event." } },
      { status: 422 },
    );
  }

  // Check registration deadline
  if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
    return NextResponse.json(
      { error: { code: "DEADLINE_PASSED", message: "Registration deadline has passed." } },
      { status: 422 },
    );
  }

  // Check if already registered
  const { data: existing } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `You are already registered as ${existing.role}.` } },
      { status: 409 },
    );
  }

  // Register as Participant
  const { error } = await supabase
    .from("event_members")
    .insert({ event_id: id, user_id: user.id, role: "Participant", status: "accepted" });

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { event_id: id, role: "Participant", status: "accepted" } }, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
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

  // Can only withdraw before SubmissionOpen
  const { data: event } = await supabase
    .from("events")
    .select("state")
    .eq("id", id)
    .single();

  const withdrawAllowedStates = new Set(["RegistrationOpen", "RegistrationClosed"]);
  if (!event || !withdrawAllowedStates.has(event.state)) {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "Cannot withdraw at this stage." } },
      { status: 422 },
    );
  }

  const { error } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", id)
    .eq("user_id", user.id)
    .eq("role", "Participant");

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { withdrawn: true } });
}
