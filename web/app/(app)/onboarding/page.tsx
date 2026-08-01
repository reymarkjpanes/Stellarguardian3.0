/**
 * Onboarding Page (Req 1: Organizer Onboarding Flow).
 *
 * Dedicated /onboarding page blocking access to /dashboard until
 * display name and default workspace are provided.
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: rawWorkspaceMemberships }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).single(),
    supabase.from("workspace_members").select("workspace_id").eq("user_id", user.id),
  ]);

  const hasValidDisplayName = !!profile?.display_name && profile.display_name !== user.email;
  const hasWorkspaces = (rawWorkspaceMemberships ?? []).length > 0;

  // Server check: If user already has a valid display_name and workspaces.length > 0, redirect("/dashboard")
  if (hasValidDisplayName && hasWorkspaces) {
    redirect("/dashboard");
  }

  const initialDisplayName =
    profile?.display_name && profile.display_name !== user.email
      ? profile.display_name
      : user.user_metadata?.full_name || "";

  return <OnboardingForm initialDisplayName={initialDisplayName} />;
}
