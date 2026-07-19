/**
 * KMS envelope encryption service for escrow secret keys (Req 4.2).
 *
 * Production: Uses AWS KMS for envelope encryption.
 * Development: Uses Node.js crypto AES-256-GCM with a local key.
 *
 * The escrow keypair secret is NEVER stored in plaintext — it's always
 * encrypted at rest.
 *
 * SECURITY NOTES:
 * - Production requires: KMS_KEY_ARN env var + AWS credentials + @aws-sdk/client-kms
 * - Development uses AES-256-GCM (cryptographically secure)
 * - The local dev key MUST NOT be used in production
 */
import "server-only";
import { logger } from "@/lib/logger";
import * as crypto from "node:crypto";

const KMS_KEY_ARN = process.env.KMS_KEY_ARN;
const LOCAL_ENCRYPTION_KEY =
  process.env.LOCAL_ENCRYPTION_KEY ??
  "dev-only-key-never-use-in-production-32b";

// AES-256-GCM constants
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // 96 bits for GCM

/**
 * Encrypt a secret using envelope encryption.
 * Returns the encrypted ciphertext as a prefixed string.
 * Format: "kms:<base64>" or "aes:<iv hex>:<tag hex>:<ciphertext hex>"
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  if (KMS_KEY_ARN) {
    return kmsEncrypt(plaintext);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "KMS_KEY_ARN must be set in production. Local encryption is not allowed.",
    );
  }

  logger.warn("Using local AES-256-GCM — NOT suitable for production.");
  return localEncrypt(plaintext);
}

/**
 * Decrypt an encrypted secret.
 */
export async function decryptSecret(ciphertext: string): Promise<string> {
  if (ciphertext.startsWith("kms:")) {
    return kmsDecrypt(ciphertext.slice(4));
  }
  if (ciphertext.startsWith("aes:")) {
    return localDecrypt(ciphertext.slice(4));
  }
  // Legacy XOR format — should be re-encrypted
  logger.warn("Decrypting legacy format — re-encrypt stored secrets.");
  return legacyDecrypt(ciphertext);
}

// --- AWS KMS ---
// Install @aws-sdk/client-kms for production use.

async function kmsEncrypt(plaintext: string): Promise<string> {
  try {
    // @ts-expect-error — optional dependency, only installed in production
    const mod = await import("@aws-sdk/client-kms");
    const client = new mod.KMSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const command = new mod.EncryptCommand({
      KeyId: KMS_KEY_ARN,
      Plaintext: Buffer.from(plaintext, "utf-8"),
    });
    const response = await client.send(command);
    if (!response.CiphertextBlob) throw new Error("KMS returned empty CiphertextBlob");
    return `kms:${Buffer.from(response.CiphertextBlob).toString("base64")}`;
  } catch (err) {
    logger.error("KMS encryption failed", { error: String(err) });
    throw new Error("Failed to encrypt secret with KMS");
  }
}

async function kmsDecrypt(ciphertextBase64: string): Promise<string> {
  try {
    // @ts-expect-error — optional dependency, only installed in production
    const mod = await import("@aws-sdk/client-kms");
    const client = new mod.KMSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const command = new mod.DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertextBase64, "base64"),
    });
    const response = await client.send(command);
    if (!response.Plaintext) throw new Error("KMS returned empty Plaintext");
    return Buffer.from(response.Plaintext).toString("utf-8");
  } catch (err) {
    logger.error("KMS decryption failed", { error: String(err) });
    throw new Error("Failed to decrypt secret with KMS");
  }
}

// --- Local AES-256-GCM (development only) ---

function deriveKey(): Buffer {
  const derived = crypto.hkdfSync(
    "sha256",
    LOCAL_ENCRYPTION_KEY,
    "stellar-guardian-kms-local",
    "encryption-key-v1",
    32,
  );
  return Buffer.from(derived);
}

function localEncrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aes:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function localDecrypt(formatted: string): string {
  const parts = formatted.split(":");
  if (parts.length !== 3) throw new Error("Invalid AES ciphertext format");
  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex!, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex!, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextHex!, "hex")), decipher.final()]);
  return decrypted.toString("utf-8");
}

// --- Legacy XOR (migration support) ---

function legacyDecrypt(ciphertext: string): string {
  const key = Buffer.from(LOCAL_ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const cipherBuf = Buffer.from(ciphertext, "hex");
  const result = Buffer.alloc(cipherBuf.length);
  for (let i = 0; i < cipherBuf.length; i++) {
    result[i] = cipherBuf[i]! ^ key[i % key.length]!;
  }
  return result.toString("utf-8");
}
