import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Root page — redirects authenticated users to dashboard,
 * unauthenticated users to login.
 */
export default async function HomePage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
