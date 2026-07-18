/**
 * Wallet entity schemas (Req 5, 25, 33.15).
 * Mirrors the `wallets` and `wallet_challenges` tables from design.md.
 */
import { z } from "zod";
import { StellarPublicKeySchema, TimestampSchema, UuidSchema } from "./common";
import { NetworkModeSchema } from "./enums";

export const WalletVerificationStatusSchema = z.enum(["Unverified", "Pending", "Verified"]);
export type WalletVerificationStatus = z.infer<typeof WalletVerificationStatusSchema>;

export const WalletSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  publicKey: StellarPublicKeySchema,
  provider: z.string().min(1),
  verificationStatus: WalletVerificationStatusSchema,
  verifiedAt: TimestampSchema.nullable().optional(),
  networkMode: NetworkModeSchema,
});
export type Wallet = z.infer<typeof WalletSchema>;

/** A challenge-response nonce issued for wallet ownership verification (Req 5.1, 5.5). */
export const WalletChallengeSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  claimedPublicKey: StellarPublicKeySchema,
  /** Base64-encoded 32-byte nonce. */
  nonce: z.base64(),
  expiresAt: TimestampSchema,
  consumedAt: TimestampSchema.nullable().optional(),
});
export type WalletChallenge = z.infer<typeof WalletChallengeSchema>;

/** Request body for `/api/auth/wallet/challenge` (Req 7.2 of wallet verifier). */
export const WalletChallengeRequestSchema = z.object({
  claimedPublicKey: StellarPublicKeySchema,
});
export type WalletChallengeRequest = z.infer<typeof WalletChallengeRequestSchema>;

/** Request body for `/api/auth/wallet/verify`. */
export const WalletVerifyRequestSchema = z.object({
  challengeId: UuidSchema,
  /** Base64-encoded signature produced by signing the nonce. */
  signature: z.base64(),
});
export type WalletVerifyRequest = z.infer<typeof WalletVerifyRequestSchema>;
