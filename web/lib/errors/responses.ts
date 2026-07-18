/**
 * Success envelope helpers (Req 18.1, 18.3).
 *
 * Runtime counterparts to the `successEnvelope()`/`paginatedEnvelope()` Zod
 * schema factories in `@/types`: these build the actual `NextResponse` a
 * route handler returns, with the status code mapping below applied
 * consistently everywhere instead of being repeated per-handler.
 *
 * Status code mapping (Req 18.3):
 *   200 - okResponse        read/update success, single resource: `{ data }`
 *   201 - createdResponse   creation success, single resource: `{ data }`
 *   204 - noContentResponse deletion/no-content success: empty body
 *   200 - paginatedResponse read success, collection: `{ data, meta }`
 *
 * Error statuses (400/401/403/404/409/422/429/503) are produced by
 * `handleApiError` in `./handler.ts`, not here.
 */
import { NextResponse } from "next/server";
import type { PaginationMeta } from "@/types";

/** `{ data }` success envelope for a single resource. Defaults to 200 (read/update). */
export function okResponse<T>(data: T, status: 200 | 201 = 200): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

/** `{ data }` success envelope at 201, for resource creation (Req 18.3). */
export function createdResponse<T>(data: T): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status: 201 });
}

/** Empty 204 response, for deletion/no-content success (Req 18.3). */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/** `{ data, meta }` success envelope for a paginated collection (Req 12.1-12.2, 18.1). */
export function paginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
): NextResponse<{ data: T[]; meta: PaginationMeta }> {
  return NextResponse.json({ data, meta }, { status: 200 });
}
