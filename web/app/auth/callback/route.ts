/**
 * Auth Callback Route Handler.
 *
 * Handles Supabase Auth redirects for:
 * - Email confirmation (signup verification)
 * - Password reset (recovery flow)
 * - Magic link login
 *
 * This is the PKCE flow token exchange endpoint.
 * Context7 verified: uses supabase.auth.verifyOtp({ type, token_hash }).
 */
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (token_hash && type) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // For password recovery, redirect to the update-password page
      if (type === "recovery") {
        redirectTo.pathname = "/reset-password";
        return NextResponse.redirect(redirectTo);
      }
      // For email confirmation or magic link, redirect to next
      return NextResponse.redirect(redirectTo);
    }
  }

  // Token invalid or missing — show error
  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(redirectTo);
}
