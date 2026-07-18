/**
 * API response envelope schema factories (Req 12.2, 18.1, 18.2, 18.3).
 *
 * Every route handler response conforms to one of three shapes:
 *   - success (single resource):      { data }
 *   - success (paginated collection): { data: [...], meta: { cursor, hasMore, total } }
 *   - error:                          { error: { code, message, details? } }
 *
 * These are generic Zod schema factories so each endpoint can produce a
 * concretely-typed envelope schema by passing its own data/item schema.
 */
import { z } from "zod";

/** Canonical error envelope shape (Req 18.1, 18.4, 20.5). */
export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/** Cursor-based pagination metadata (Req 12.1). */
export const PaginationMetaSchema = z.object({
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.int().nonnegative().optional(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Success envelope factory for a single resource: `{ data: T }`.
 *
 * @example
 * const EventResponseSchema = successEnvelope(EventSchema);
 */
export function successEnvelope<T extends z.ZodType>(dataSchema: T) {
  return z.object({ data: dataSchema });
}

/**
 * Success envelope factory for a paginated collection:
 * `{ data: T[], meta: { cursor, hasMore, total } }`.
 *
 * @example
 * const EventListResponseSchema = paginatedEnvelope(EventSchema);
 */
export function paginatedEnvelope<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });
}

/** Query params shared by every cursor-paginated list endpoint (Req 12.1). */
export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
