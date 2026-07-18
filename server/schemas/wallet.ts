/**
 * server/schemas/wallet.ts
 * Zod validation schemas for Stellar wallet-related endpoints.
 */
import { z } from 'zod';

// Stellar public keys are 56 characters starting with G
const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

// ─── Connect Wallet ───────────────────────────────────────────────────────────
// walletAddress can be null (disconnect) or a valid Stellar public key (connect)
export const ConnectWalletSchema = z.object({
  walletAddress: z
    .string()
    .regex(STELLAR_ADDRESS_REGEX, 'Must be a valid Stellar public key (starts with G, 56 characters)')
    .nullable(),
});

export type ConnectWalletInput = z.infer<typeof ConnectWalletSchema>;
