/**
 * Dispute lifecycle schemas (Req 7, 39, 30.6).
 * Mirrors the `disputes` and `dispute_evidence` tables from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema, VersionSchema } from "./common";
import { DisputeStateSchema } from "./enums";

export const DisputeSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  filerId: UuidSchema,
  state: DisputeStateSchema,
  reason: z.string().min(1).max(5000),
  createdAt: TimestampSchema,
  resolvedAt: TimestampSchema.nullable().optional(),
  version: VersionSchema,
});
export type Dispute = z.infer<typeof DisputeSchema>;

export const DisputeEvidenceSchema = z.object({
  id: UuidSchema,
  disputeId: UuidSchema,
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.int().nonnegative(),
});
export type DisputeEvidence = z.infer<typeof DisputeEvidenceSchema>;

/** Request body for filing a dispute (Req 7.1, 7.3, 39.2). */
export const CreateDisputeSchema = z.object({
  eventId: UuidSchema,
  reason: DisputeSchema.shape.reason,
});
export type CreateDispute = z.infer<typeof CreateDisputeSchema>;

/** Request body for transitioning a dispute's state (Req 39.3, 39.4). */
export const TransitionDisputeStateSchema = z.object({
  toState: DisputeStateSchema,
  version: VersionSchema,
});
export type TransitionDisputeState = z.infer<typeof TransitionDisputeStateSchema>;
