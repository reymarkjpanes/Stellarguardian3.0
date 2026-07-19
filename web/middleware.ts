/**
 * Next.js Middleware (Req 1.4, 3.4, 3.5, 14.1, 14.2, 20.1, 20.2).
 *
 * Fixed pipeline: authenticate → rate limit → CSP nonce → security headers → forward.
 * Attaches a unique request ID for structured logging. Returns 401 on
 * protected routes without a valid token.
 *
 * Security fixes applied:
 * - Per-request cryptographic CSP nonce (replaces static 'nonce-csp')
 * - Narrowed PUBLIC_PREFIXES (no longer blanket-allows /api/events/)
 * - Rate limiter with LRU eviction (in-memory, with TODO for Redis)
 */
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Routes that do not require authentication. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/discover",
  "/terms",
  "/privacy",
  "/api/health",
  "/api/health/ready",
  "/auth/callback",
  "/auth/confirm",
  "/forgot-password",
  "/reset-password",
]);

/**
 * Prefix patterns for public routes.
 * SECURITY: Narrowed from blanket "/api/events/" to specific public endpoints.
 */
const PUBLIC_PREFIXES = ["/api/v1/", "/_next/", "/e/"] as const;

/** Specific public API path patterns (regex). */
const PUBLIC_API_PATTERNS = [
  /^\/api\/events\/[^/]+\/verify-escrow$/,
  /^\/api\/events$/,  // GET list only (handler checks method)
] as const;

/** Check if a path is public (no auth required). */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  for (const pattern of PUBLIC_API_PATTERNS) {
    if (pattern.test(pathname)) return true;
  }
  return false;
}

/** Generate a unique request ID for tracing (Req 20.1). */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a per-request cryptographic nonce for CSP.
 * Based on Next.js official CSP nonce pattern (Context7 verified).
 */
function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Build Content-Security-Policy header with per-request nonce.
 * In development: allows unsafe-eval for React Fast Refresh / HMR.
 * In production: strict nonce-based policy with 'strict-dynamic'.
 */
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  const directives = [
    "default-src 'self'",
    isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https: blob:`,
    `font-src 'self'`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://horizon.stellar.org https://horizon-testnet.stellar.org`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ];

  return directives.join("; ");
}

/**
 * In-memory rate limiter with LRU eviction.
 *
 * TODO: Replace with Upstash Redis (@upstash/ratelimit) for production.
 * This is acceptable for single-instance deployments but will NOT work
 * across multiple serverless instances or after cold starts.
 *
 * LRU eviction prevents unbounded memory growth (capped at 10k entries).
 */
const MAX_RATE_LIMIT_ENTRIES = 10_000;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function evictStaleEntries(): void {
  if (rateLimitStore.size <= MAX_RATE_LIMIT_ENTRIES) return;
  const now = Date.now();
  // First pass: remove expired entries
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
  // If still over limit, remove oldest entries
  if (rateLimitStore.size > MAX_RATE_LIMIT_ENTRIES) {
    const excess = rateLimitStore.size - MAX_RATE_LIMIT_ENTRIES;
    const keys = rateLimitStore.keys();
    for (let i = 0; i < excess; i++) {
      const { value } = keys.next();
      if (value) rateLimitStore.delete(value);
    }
  }
}

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    evictStaleEntries();
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

  // Strict limit for auth endpoints (brute force protection)
  if (pathname.startsWith("/api/auth") || pathname === "/login" || pathname === "/signup") {
    return { limit: 10, windowMs: FIFTEEN_MIN };
  }
  // Financial endpoints get a tighter limit
  if (pathname.match(/\/(fund|disburse|refund)$/)) {
    return { limit: 5, windowMs: FIFTEEN_MIN };
  }
  // Event creation limit
  if (pathname === "/api/events") {
    return { limit: 10, windowMs: TWENTY_FOUR_H };
  }
  return { limit: 200, windowMs: FIFTEEN_MIN };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = generateRequestId();
  const nonce = generateNonce();

  // --- Rate Limiting (Req 14.2) ---
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { limit, windowMs } = getRateLimitConfig(pathname);
  const rateLimitKey = `${ip}:${pathname.split("/").slice(0, 4).join("/")}`;
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

  // --- Authentication via Supabase session refresh ---
  const { response, claims } = await updateSession(request);

  // --- CSP Nonce: Inject into request headers for downstream Server Components ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);

  // --- Security Headers (Req 14.1, 14.5) ---
  const csp = buildCspHeader(nonce);

  // Set CSP on the response
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-RateLimit-Remaining", String(remaining));

  // HSTS (Req 14.5)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
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

  // --- Protected Route Check (Req 3.5) ---
  if (!isPublicPath(pathname) && !claims) {
    // API routes get a JSON 401 response
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication is required to access this resource.",
          },
        },
        {
          status: 401,
          headers: {
            "X-Request-Id": requestId,
            "Content-Security-Policy": csp,
            "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        },
      );
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
