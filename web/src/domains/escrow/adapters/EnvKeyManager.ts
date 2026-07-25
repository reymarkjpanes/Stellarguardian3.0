import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { TransactionSigner } from '../domain/EscrowProvider';

/**
 * Uses a pre-provisioned environment variable to sign transactions.
 * Supports STELLAR_SECRET_KEY (direct) or falls back to generating
 * a deterministic keypair from DEPLOYER_SECRET for Testnet operations.
 *
 * Keeps raw secrets out of the domain logs and limits scope.
 */
export class EnvKeyManager implements TransactionSigner {
  private keypair: Keypair;

  constructor() {
    const secret = process.env.STELLAR_SECRET_KEY ?? process.env.DEPLOYER_SECRET;
    if (!secret) {
      // On testnet, generate a random keypair for development.
      // In production, this should always be configured.
      if (process.env.STELLAR_NETWORK_MODE === 'mainnet') {
        throw new Error('STELLAR_SECRET_KEY or DEPLOYER_SECRET is required for mainnet operations.');
      }
      // Generate a random keypair for testnet dev — it will need funding via Friendbot
      this.keypair = Keypair.random();
      console.warn('[EnvKeyManager] No STELLAR_SECRET_KEY found — using random keypair for testnet dev:', this.keypair.publicKey());
    } else {
      this.keypair = Keypair.fromSecret(secret);
    }
  }

  async sign(transaction: Transaction): Promise<Transaction> {
    transaction.sign(this.keypair);
    return transaction;
  }

  getPublicKey(): string {
    return this.keypair.publicKey();
  }
}
