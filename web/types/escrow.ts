/**
 * Escrow account schemas (Req 4, 26).
 * Mirrors the `escrow_accounts` table from design.md.
 *
 * The secret key is never exposed via a read API; `encryptedSecretKey` is
 * intentionally omitted from the public-facing schema and only exists in the
 * server-only persistence layer, not in `/types`.
 */
import { z } from "zod";
import { AmountSchema, StellarPublicKeySchema, UuidSchema, VersionSchema } from "./common";
import { EscrowStateSchema } from "./enums";

export const EscrowAccountSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  stellarPublicKey: StellarPublicKeySchema,
  state: EscrowStateSchema,
  expectedBalance: AmountSchema,
  lastReconciledBalance: AmountSchema.nullable().optional(),
  lastReconciledBlock: z.int().nonnegative().nullable().optional(),
  /** Signer/refund destination (Req 4.8) — the organizer's verified wallet. */
  fundingWallet: StellarPublicKeySchema.nullable().optional(),
  inconsistent: z.boolean().default(false),
  version: VersionSchema,
});
export type EscrowAccount = z.infer<typeof EscrowAccountSchema>;

/** Request body for funding an escrow account (Req 4.1, 4.8). */
export const FundEscrowRequestSchema = z.object({
  eventId: UuidSchema,
  fundingWallet: StellarPublicKeySchema,
  amount: AmountSchema,
  txHash: z.string().min(1),
});
export type FundEscrowRequest = z.infer<typeof FundEscrowRequestSchema>;

/** Response body for the public on-chain escrow verification endpoint (Req 26.5, 26.7). */
export const EscrowVerificationSchema = z.object({
  eventId: UuidSchema,
  stellarPublicKey: StellarPublicKeySchema,
  onChainBalance: AmountSchema,
  dbBalance: AmountSchema,
  inconsistent: z.boolean(),
  history: z.array(
    z.object({
      txHash: z.string(),
      amount: AmountSchema,
      type: z.enum(["fund", "disbursement", "refund", "escrow_op"]),
    }),
  ),
});
export type EscrowVerification = z.infer<typeof EscrowVerificationSchema>;
