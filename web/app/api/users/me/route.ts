/**
 * GET /api/users/me — Current user profile.
 * PATCH /api/users/me — Update profile.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  terms_accepted_version: z.string().optional(),
});

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch wallets
  const { data: wallets } = await supabase
    .from("wallets")
    .select("id, public_key, provider, verification_status, network_mode, verified_at")
    .eq("user_id", user.id);

  return NextResponse.json({
    data: {
      ...profile,
      email: user.email,
      wallets: wallets ?? [],
    },
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = UpdateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.display_name) updates.display_name = parsed.data.display_name;
  if (parsed.data.terms_accepted_version) {
    updates.terms_accepted_version = parsed.data.terms_accepted_version;
    updates.terms_accepted_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: null, message: "No updates provided." });
  }

  const { data: updated, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: updated });
}
