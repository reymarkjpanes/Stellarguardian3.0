/**
 * Transaction ledger schemas (Req 4.4, 9.3, 25.7).
 * Mirrors the `transactions` table from design.md.
 */
import { z } from "zod";
import { AmountSchema, StellarPublicKeySchema, TimestampSchema, UuidSchema } from "./common";
import { NetworkModeSchema } from "./enums";

export const TransactionTypeSchema = z.enum(["fund", "disbursement", "refund", "escrow_op"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionStatusSchema = z.enum(["pending", "confirmed", "failed"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const TransactionSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  escrowId: UuidSchema.nullable().optional(),
  type: TransactionTypeSchema,
  /** Canonical on-chain hash (Req 4.4) — never a synthetic/internal id. */
  txHash: z.string().min(1),
  amount: AmountSchema,
  fromAddress: StellarPublicKeySchema,
  toAddress: StellarPublicKeySchema,
  status: TransactionStatusSchema,
  networkMode: NetworkModeSchema,
  createdAt: TimestampSchema,
});
export type Transaction = z.infer<typeof TransactionSchema>;
