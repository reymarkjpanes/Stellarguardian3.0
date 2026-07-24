/**
 * Cloudflare Turnstile CAPTCHA verification (Phase 3, Task 3.3).
 *
 * Server-side validation of Turnstile tokens.
 * The client component renders the Turnstile widget and submits the token
 * alongside the form data. This module validates the token against
 * Cloudflare's siteverify endpoint.
 *
 * Environment variables:
 * - TURNSTILE_SECRET_KEY (server-only, required in production)
 * - NEXT_PUBLIC_TURNSTILE_SITE_KEY (client-side, for widget rendering)
 *
 * In development (missing secret key), verification is bypassed with a warning.
 */
import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
}

/**
 * Verify a Turnstile token server-side.
 * Returns { success: true } if valid, or { success: false, error } if not.
 *
 * In development without TURNSTILE_SECRET_KEY, always returns success
 * to avoid blocking local testing.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Dev bypass: if no secret key configured, skip verification
  if (!secretKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[captcha] TURNSTILE_SECRET_KEY not configured in production!");
      return { success: false, error: "CAPTCHA service not configured." };
    }
    console.warn("[captcha] TURNSTILE_SECRET_KEY not set — bypassing verification (dev mode).");
    return { success: true };
  }

  if (!token) {
    return { success: false, error: "CAPTCHA verification required." };
  }

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(remoteIp && { remoteip: remoteIp }),
    });

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      return { success: false, error: "CAPTCHA verification service unavailable." };
    }

    const data = await res.json();

    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: "CAPTCHA verification failed. Please try again.",
    };
  } catch (err) {
    console.error("[captcha] Verification request failed:", err);
    return { success: false, error: "CAPTCHA verification service error." };
  }
}
