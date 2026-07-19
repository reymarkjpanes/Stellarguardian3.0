/**
 * API Versioning Strategy (L5).
 *
 * Design decisions:
 * - URL-based versioning for public API (/api/v1/, /api/v2/)
 * - Internal routes (no version prefix) are considered "latest"
 * - Deprecation is communicated via Sunset + Deprecation headers
 * - Old versions remain functional during the deprecation window
 *
 * Usage in Route Handlers:
 *   import { withDeprecationHeaders } from "@/lib/api/versioning";
 *   return withDeprecationHeaders(response, "v1", "2026-12-31");
 */
import "server-only";

export const API_VERSIONS = {
  v1: {
    released: "2025-01-01",
    deprecated: null as string | null,
    sunset: null as string | null,
  },
} as const;

export type ApiVersion = keyof typeof API_VERSIONS;

/**
 * Add deprecation headers to a Response (RFC 8594).
 */
export function withDeprecationHeaders(
  response: Response,
  version: ApiVersion,
  sunsetDate?: string,
): Response {
  const versionInfo = API_VERSIONS[version];

  if (versionInfo.deprecated || sunsetDate) {
    response.headers.set("Deprecation", versionInfo.deprecated ?? "true");
    if (sunsetDate || versionInfo.sunset) {
      response.headers.set("Sunset", sunsetDate ?? versionInfo.sunset ?? "");
    }
    response.headers.set(
      "Link",
      `</api/v2>; rel="successor-version"`,
    );
  }

  response.headers.set("X-API-Version", version);
  return response;
}

/**
 * Extract the API version from a request path.
 */
export function getApiVersion(pathname: string): ApiVersion | "latest" {
  const match = pathname.match(/^\/api\/(v\d+)\//);
  if (match?.[1] && match[1] in API_VERSIONS) {
    return match[1] as ApiVersion;
  }
  return "latest";
}
