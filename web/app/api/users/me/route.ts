/**
 * GET /api/users/me — Current user profile.
 * PATCH /api/users/me — Update profile.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  skills: z.array(z.string()).optional(),
  terms_accepted_version: z.string().optional(),
});
export const GET = withErrorHandling(async function GET() {
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

  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();

  // Fetch wallets
  const { data: wallets } = await supabase
    .from("wallets")
    .select("id, public_key, provider, verification_status, network_mode, verified_at")
    .eq("user_id", user.id);

  // Fetch skills
  const { data: userSkills } = await supabase
    .from("user_skills")
    .select("skill_id")
    .eq("user_id", user.id);
  const skills = (userSkills ?? []).map((s) => s.skill_id);

  return NextResponse.json({
    data: {
      ...profile,
      email: user.email,
      wallets: wallets ?? [],
      skills,
    },
  });
});
export const PATCH = withErrorHandling(async function PATCH(request: NextRequest) {
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
  const parsed = UpdateProfileSchema.safeParse(body);

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

  const updates: Record<string, unknown> = {};
  if (parsed.data.display_name !== undefined) updates.display_name = parsed.data.display_name;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
  if (parsed.data.avatar_url !== undefined) updates.avatar_url = parsed.data.avatar_url;

  if (parsed.data.terms_accepted_version) {
    updates.terms_accepted_version = parsed.data.terms_accepted_version;
    updates.terms_accepted_at = new Date().toISOString();
  }

  if (Object.keys(updates).length > 0) {
    // Try UPDATE first with the authenticated client (respects RLS).
    // A row in public.users is normally created by a Supabase trigger on
    // auth.users INSERT. If that trigger hasn't run yet (race condition on
    // first login, or missing trigger in some environments), the UPDATE will
    // affect 0 rows. In that case we fall back to INSERT via the service
    // client (which bypasses RLS) so onboarding never silently fails.
    const { error: updateError, count } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id)
      .select("id", { count: "exact", head: true });

    if (updateError) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: updateError.message } },
        { status: 500 },
      );
    }

    // Row didn't exist — create it via service client (bypasses RLS INSERT restriction)
    if (count === 0) {
      const { createServiceClient } = await import("@/lib/supabase/service");
      const serviceClient = createServiceClient();
      const { error: insertError } = await serviceClient.from("users").insert({
        id: user.id,
        email: user.email ?? "",
        ...updates,
      });

      if (insertError) {
        return NextResponse.json(
          { error: { code: "INTERNAL_ERROR", message: insertError.message } },
          { status: 500 },
        );
      }
    }
  }

  if (parsed.data.display_name !== undefined && typeof supabase.auth.updateUser === "function") {
    await supabase.auth.updateUser({
      data: { display_name: parsed.data.display_name },
    });
  }

  // Update skills if provided
  if (parsed.data.skills !== undefined) {
    // delete old skills
    await supabase.from("user_skills").delete().eq("user_id", user.id);

    // insert new skills
    if (parsed.data.skills.length > 0) {
      const { error: skillsError } = await supabase.from("user_skills").insert(
        parsed.data.skills.map((skillId) => ({
          user_id: user.id,
          skill_id: skillId,
        })),
      );
      if (skillsError) {
        return NextResponse.json(
          { error: { code: "INTERNAL_ERROR", message: skillsError.message } },
          { status: 500 },
        );
      }
    }
  }

  // Fetch updated profile
  const { data: updated, error: updatedError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (updatedError) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: updatedError.message } },
      { status: 500 },
    );
  }

  // Fetch skills
  const { data: userSkills } = await supabase
    .from("user_skills")
    .select("skill_id")
    .eq("user_id", user.id);
  const skills = (userSkills ?? []).map((s: { skill_id: string }) => s.skill_id);

  return NextResponse.json({ data: { ...updated, skills } });
});
