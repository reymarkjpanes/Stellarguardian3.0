/**
 * Idempotency key schemas (Req 13).
 * Mirrors the `idempotency_keys` table from design.md.
 */
import { z } from "zod";
import { TimestampSchema } from "./common";

export const IdempotencyKeyRecordSchema = z.object({
  key: z.string().min(1).max(255),
  endpoint: z.string().min(1),
  requestHash: z.string().min(1),
  responsePayload: z.record(z.string(), z.unknown()).nullable().optional(),
  statusCode: z.int().min(100).max(599),
  /** created_at + 24h (Req 13.3). */
  expiresAt: TimestampSchema,
});
export type IdempotencyKeyRecord = z.infer<typeof IdempotencyKeyRecordSchema>;

/** The client-supplied `Idempotency-Key` header value (Req 13.1). */
export const IdempotencyKeyHeaderSchema = z.string().min(1).max(255);
export type IdempotencyKeyHeader = z.infer<typeof IdempotencyKeyHeaderSchema>;
