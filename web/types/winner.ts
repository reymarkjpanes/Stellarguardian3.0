/**
 * Prize winner schemas (Req 8).
 * Mirrors the `winners` table from design.md.
 */
import { z } from "zod";
import { AmountSchema, UuidSchema, VersionSchema } from "./common";

export const WinnerStatusSchema = z.enum(["pending", "disbursed", "held", "skipped"]);
export type WinnerStatus = z.infer<typeof WinnerStatusSchema>;

export const WinnerSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  recipientId: UuidSchema,
  teamId: UuidSchema.nullable().optional(),
  prizeAmount: AmountSchema,
  disbursementTxHash: z.string().nullable().optional(),
  status: WinnerStatusSchema,
  version: VersionSchema,
});
export type Winner = z.infer<typeof WinnerSchema>;

/** Request body for declaring winners/prize allocation (Req 8.1, 8.2). */
export const AllocatePrizesSchema = z.object({
  eventId: UuidSchema,
  allocations: z.array(
    z.object({
      recipientId: UuidSchema,
      teamId: UuidSchema.optional(),
      prizeAmount: AmountSchema,
    }),
  ),
});
export type AllocatePrizes = z.infer<typeof AllocatePrizesSchema>;
