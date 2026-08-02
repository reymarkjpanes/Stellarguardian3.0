/**
 * Next.js Proxy (Req 1.4, 3.4, 3.5, 14.1, 14.2, 20.1, 20.2).
 *
 * Renamed from middleware.ts → proxy.ts per Next.js 16 convention.
 * Pipeline: authenticate → rate limit → CSP nonce → security headers → forward.
 * Attaches a unique request ID for structured logging. Returns 401 on
 * protected routes without a valid token. Returns 429 when rate limit exceeded.
 */
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, resolveRateLimitTier } from "@/lib/rate-limit";

/** Routes that do not require authentication. */
const PUBLIC_PATHS = new Set([
  "/",
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
  /^\/api\/events$/, // GET list only (handler checks method)
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
 * Based on Next.js official CSP nonce pattern.
 */
function generateNonce(): string {
  return btoa(crypto.randomUUID());
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = generateRequestId();
  const nonce = generateNonce();

  // --- Request Body Size Limit (2MB) ---
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds 2MB limit." } },
      { status: 413, headers: { "X-Request-Id": requestId } },
    );
  }

  // --- Cron Endpoint Protection ---
  if (pathname.startsWith("/api/cron/")) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!cronSecret || token !== cronSecret) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid cron authentication." } },
        { status: 401, headers: { "X-Request-Id": requestId } },
      );
    }
    // Cron requests bypass auth/rate-limit — they're authenticated by secret
    const cronResponse = NextResponse.next({ request });
    cronResponse.headers.set("X-Request-Id", requestId);
    return cronResponse;
  }

  // --- Authentication via Supabase session refresh ---
  let sessionResult;
  try {
    sessionResult = await updateSession(request);
  } catch (error: unknown) {
    // If environment variables are missing, updateSession will throw an Error from env.ts
    if (
      error instanceof Error &&
      error.message?.includes("Missing required environment variable")
    ) {
      return new NextResponse(
        `
        <html>
          <body style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 0 auto; line-height: 1.5;">
            <h1 style="color: #ef4444;">Configuration Error</h1>
            <p><strong>Stellar Guardian is almost ready, but it's missing its environment variables!</strong></p>
            <p>The server is throwing this error:</p>
            <pre style="background: #f1f5f9; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 14px;">${error.message}</pre>
            <p><strong>To fix this:</strong></p>
            <ol>
              <li>Go to your Vercel Dashboard -> Settings -> Environment Variables.</li>
              <li>Make sure you pasted ALL the variables provided previously.</li>
              <li>Make sure the "Production" environment checkbox was checked.</li>
              <li>After saving, go to the <strong>Deployments</strong> tab and trigger a <strong>Redeploy</strong>.</li>
            </ol>
          </body>
        </html>
        `,
        { status: 500, headers: { "Content-Type": "text/html" } },
      );
    }
    throw error;
  }
  const { response, claims } = sessionResult;

  // --- Rate Limiting (Req 14.2) ---
  const tier = resolveRateLimitTier(pathname, request.method, !!claims);
  if (tier) {
    // Use user ID if authenticated, otherwise fall back to IP
    const identifier = claims?.sub ?? request.headers.get("x-forwarded-for") ?? "anonymous";
    const rlResult = await checkRateLimit(identifier, tier);

    if (!rlResult.success) {
      const retryAfter = Math.ceil((rlResult.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(rlResult.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rlResult.reset),
            "X-Request-Id": requestId,
          },
        },
      );
    }
  }

  // --- Security Headers ---
  const csp = buildCspHeader(nonce);

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  response.headers.set("X-Request-Id", requestId);

  // HSTS (Req 14.5)
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

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
