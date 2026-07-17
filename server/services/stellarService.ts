/**
 * server/services/stellarService.ts
 * Stellar SDK integration for escrow funding and prize disbursement.
 *
 * Design Decision (confirmed):
 * - Stellar SDK Testnet for v1. No Soroban smart contracts.
 * - Each event gets an ephemeral escrow keypair generated at fund time.
 * - The escrow secret is stored AES-256-GCM encrypted in the database.
 * - Disbursement is handled server-side by decrypting the escrow secret.
 *
 * Network: configured via STELLAR_NETWORK env var ('testnet' | 'mainnet')
 */
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Asset,
  Operation,
  Networks,
  Memo,
} from '@stellar/stellar-sdk';
import crypto from 'crypto';

// ─── Configuration ─────────────────────────────────────────────────────────────

const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

const IS_TESTNET = process.env.STELLAR_NETWORK !== 'mainnet';

let server: Horizon.Server | null = null;

function getServer(): Horizon.Server {
  if (!server) {
    server = new Horizon.Server(HORIZON_URL);
  }
  return server;
}

// ─── Encryption for Stored Escrow Secrets ─────────────────────────────────────

const ENCRYPTION_KEY_ENV = 'STELLAR_ESCROW_ENCRYPTION_KEY';

function getEncryptionKey(): Buffer {
  const key = process.env[ENCRYPTION_KEY_ENV];
  if (!key) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} is not set. Cannot encrypt/decrypt escrow secrets.`,
    );
  }
  // Key must be 32 bytes (64 hex chars) for AES-256
  if (key.length !== 64) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be exactly 64 hex characters (32 bytes).`);
  }
  return Buffer.from(key, 'hex');
}

export function encryptSecret(plainSecret: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex');
}

export function decryptSecret(encryptedSecret: string): string {
  const iv = Buffer.from(encryptedSecret.slice(0, 24), 'hex');
  const authTag = Buffer.from(encryptedSecret.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(encryptedSecret.slice(56), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

// ─── Escrow Funding ───────────────────────────────────────────────────────────

export interface FundEventResult {
  txHash: string;
  escrowPublicKey: string;
  encryptedEscrowSecret: string;
  amount: string;
  explorerUrl: string;
}

/**
 * Fund an event's escrow account.
 * Creates a new ephemeral keypair for the escrow account, funds it from
 * the platform's escrow wallet, and returns the TX hash for verification.
 *
 * @param prizeAmountXLM - Amount to place in escrow (as string, e.g. "1000")
 * @param eventId - Event ID for the Memo field
 */
export async function fundEventEscrow(
  prizeAmountXLM: string,
  eventId: number,
): Promise<FundEventResult> {
  const platformSecret = process.env.STELLAR_ESCROW_SECRET;
  if (!platformSecret) {
    throw new Error('STELLAR_ESCROW_SECRET is not configured.');
  }

  const platformKeypair = Keypair.fromSecret(platformSecret);
  const eventEscrowKeypair = Keypair.random(); // Ephemeral keypair for this event

  const srv = getServer();
  const sourceAccount = await srv.loadAccount(platformKeypair.publicKey());

  // Account minimum reserve (2 XLM) + prize amount
  const fundingAmount = (Number(prizeAmountXLM) + 2).toString();

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createAccount({
        destination: eventEscrowKeypair.publicKey(),
        startingBalance: fundingAmount,
      }),
    )
    .addMemo(Memo.text(`sg:event:${eventId}`))
    .setTimeout(30)
    .build();

  tx.sign(platformKeypair);
  const result = await srv.submitTransaction(tx);

  const explorerNetwork = IS_TESTNET ? 'testnet' : 'public';
  const explorerUrl = `https://stellar.expert/explorer/${explorerNetwork}/tx/${result.hash}`;

  return {
    txHash: result.hash,
    escrowPublicKey: eventEscrowKeypair.publicKey(),
    encryptedEscrowSecret: encryptSecret(eventEscrowKeypair.secret()),
    amount: prizeAmountXLM,
    explorerUrl,
  };
}

// ─── TX Verification ──────────────────────────────────────────────────────────

/**
 * Verify that a transaction hash exists on-chain.
 * Returns true if the transaction exists, false if not found.
 */
export async function verifyTransaction(txHash: string): Promise<boolean> {
  try {
    await getServer().transactions().transaction(txHash).call();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current XLM balance of an account.
 */
export async function getAccountBalance(publicKey: string): Promise<string | null> {
  try {
    const account = await getServer().loadAccount(publicKey);
    const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native');
    return nativeBalance?.balance ?? null;
  } catch {
    return null;
  }
}

// ─── Prize Disbursement ───────────────────────────────────────────────────────

export interface DisburseResult {
  txHash: string;
  explorerUrl: string;
}

/**
 * Disburse the prize from the escrow account to a winner.
 * The encryptedEscrowSecret is decrypted server-side to sign the transaction.
 *
 * @param encryptedEscrowSecret - The AES-256-GCM encrypted escrow secret from the database
 * @param winnerPublicKey - The winner's Stellar public key
 * @param amount - Amount in XLM to send
 */
export async function disbursePrize(
  encryptedEscrowSecret: string,
  winnerPublicKey: string,
  amount: string,
): Promise<DisburseResult> {
  const escrowSecret = decryptSecret(encryptedEscrowSecret);
  const escrowKeypair = Keypair.fromSecret(escrowSecret);

  const srv = getServer();
  const escrowAccount = await srv.loadAccount(escrowKeypair.publicKey());

  const tx = new TransactionBuilder(escrowAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: winnerPublicKey,
        asset: Asset.native(),
        amount,
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(escrowKeypair);
  const result = await srv.submitTransaction(tx);

  const explorerNetwork = IS_TESTNET ? 'testnet' : 'public';
  const explorerUrl = `https://stellar.expert/explorer/${explorerNetwork}/tx/${result.hash}`;

  return { txHash: result.hash, explorerUrl };
}
