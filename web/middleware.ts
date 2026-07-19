/**
 * Next.js Middleware (Req 1.4, 3.4, 3.5, 14.1, 14.2, 20.1, 20.2).
 *
 * Fixed pipeline: authenticate → rate limit → security headers → forward.
 * Attaches a unique request ID for structured logging. Returns 401 on
 * protected routes without a valid token.
 */
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Routes that do not require authentication. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/api/health",
  "/api/health/ready",
  "/discover",
]);

/** Prefix patterns for public routes. */
const PUBLIC_PREFIXES = ["/api/v1/", "/_next/", "/api/events/"] as const;

/** Check if a path is public (no auth required). */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  // verify-escrow endpoints are public (Req 4.6)
  if (pathname.match(/^\/api\/events\/[^/]+\/verify-escrow$/)) return true;
  return false;
}

/** Generate a unique request ID for tracing (Req 20.1). */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Security headers applied to every response (Req 14.1, 14.5). */
function applySecurityHeaders(response: NextResponse): void {
  // HSTS (Req 14.5)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  // CSP - in development, allow unsafe-eval for React debugging (Req 14.1)
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? "'self' 'unsafe-eval' 'unsafe-inline'"
    : "'self' 'nonce-csp'";
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`,
  );
  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
}

/**
 * Simple in-memory rate limiter for middleware. In production this would
 * be backed by Redis or similar. Limits per Req 14.2:
 * - auth: 10/15min
 * - general API: 200/15min per IP
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - entry.count };
}

function getRateLimitConfig(pathname: string): { limit: number; windowMs: number } {
  const FIFTEEN_MIN = 15 * 60 * 1000;
  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

  if (pathname.startsWith("/api/auth") || pathname === "/login" || pathname === "/signup") {
    return { limit: 10, windowMs: FIFTEEN_MIN };
  }
  if (pathname === "/api/events" && !pathname.includes("/")) {
    return { limit: 10, windowMs: TWENTY_FOUR_H };
  }
  return { limit: 200, windowMs: FIFTEEN_MIN };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = generateRequestId();

  // Rate limiting (Req 14.2)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { limit, windowMs } = getRateLimitConfig(pathname);
  const rateLimitKey = `${ip}:${pathname.split("/").slice(0, 3).join("/")}`;
  const { allowed, remaining } = checkRateLimit(rateLimitKey, limit, windowMs);

  if (!allowed) {
    const rateLimitResponse = NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
      { status: 429 },
    );
    rateLimitResponse.headers.set("X-Request-Id", requestId);
    rateLimitResponse.headers.set("Retry-After", String(Math.ceil(windowMs / 1000)));
    return rateLimitResponse;
  }

  // Authentication via Supabase session refresh
  const { response, claims } = await updateSession(request);

  // Attach request ID for tracing (Req 20.1, 20.2)
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-RateLimit-Remaining", String(remaining));

  // Apply security headers (Req 14.1, 14.5)
  applySecurityHeaders(response);

  // Protected route check — return 401 if no valid token (Req 3.5)
  if (!isPublicPath(pathname) && !claims) {
    // API routes get a JSON 401 response
    if (pathname.startsWith("/api/")) {
      const unauthResponse = NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication is required to access this resource.",
          },
        },
        { status: 401 },
      );
      unauthResponse.headers.set("X-Request-Id", requestId);
      applySecurityHeaders(unauthResponse);
      return unauthResponse;
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
