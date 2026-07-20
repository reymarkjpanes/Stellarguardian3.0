import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { TransactionSigner } from '../domain/EscrowProvider';

/**
 * Uses a pre-provisioned environment variable to sign transactions.
 * Keeps raw secrets out of the domain logs and limits scope.
 */
export class EnvKeyManager implements TransactionSigner {
  private keypair: Keypair;

  constructor() {
    const secret = process.env.STELLAR_SECRET_KEY;
    if (!secret) {
      throw new Error('STELLAR_SECRET_KEY is not defined in environment variables');
    }
    this.keypair = Keypair.fromSecret(secret);
  }

  async sign(transaction: Transaction): Promise<Transaction> {
    transaction.sign(this.keypair);
    return transaction;
  }

  getPublicKey(): string {
    return this.keypair.publicKey();
  }
}
