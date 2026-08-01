import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Update Supabase session at the edge
  const { response, claims } = await updateSession(request);

  // Protected routes check
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/events") ||
    request.nextUrl.pathname.startsWith("/workspaces");

  // Allow public access to certain nested paths even if root is protected
  const isPublicOverride =
    request.nextUrl.pathname === "/events/discover" ||
    request.nextUrl.pathname === "/events" ||
    (request.nextUrl.pathname.startsWith("/events/") &&
      request.nextUrl.pathname.endsWith("/public"));

  if (isProtectedRoute && !isPublicOverride && !claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
