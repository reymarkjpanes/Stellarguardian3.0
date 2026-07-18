/**
 * Append-only audit record schemas (Req 28, 31).
 * Mirrors the `audit_records` table from design.md. Audit records are
 * immutable once written — no update/patch schema is provided by design.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";

export const AuditRecordSchema = z.object({
  id: UuidSchema,
  actorId: UuidSchema.nullable().optional(),
  actorName: z.string().nullable().optional(),
  occurredAt: TimestampSchema,
  actionType: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  walletAddress: z.string().nullable().optional(),
  txHash: z.string().nullable().optional(),
  beforeState: z.record(z.string(), z.unknown()).nullable().optional(),
  afterState: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().nullable().optional(),
  requestMeta: z
    .object({
      ip: z.string().optional(),
      userAgent: z.string().optional(),
      requestId: z.string().optional(),
    })
    .nullable()
    .optional(),
  onchainStatus: z.string().nullable().optional(),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

/** Query params for filtered paginated audit exports (Req 28.7, 31.4-31.7). */
export const AuditQuerySchema = z.object({
  actorId: UuidSchema.optional(),
  actionType: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  from: TimestampSchema.optional(),
  to: TimestampSchema.optional(),
  format: z.enum(["json", "csv"]).default("json"),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;
