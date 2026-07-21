/**
 * KMS envelope encryption service for escrow secret keys (Req 4.2, Task 1.2).
 *
 * Production: Uses AWS KMS for envelope encryption.
 * Development: Uses Node.js crypto AES-256-GCM with a HKDF-derived key.
 *
 * The escrow keypair secret is NEVER stored in plaintext — it's always
 * encrypted at rest.
 *
 * SECURITY NOTES:
 * - Production requires: KMS_KEY_ARN env var + AWS credentials + @aws-sdk/client-kms
 * - Development requires: LOCAL_ENCRYPTION_KEY env var (no hardcoded default — Task 1.2)
 * - Legacy XOR code path has been removed (Task 1.2)
 * - Run `web/scripts/migrate-escrow-keys.ts` to re-encrypt any legacy records
 */
import "server-only";
import { logger } from "@/lib/logger";
import * as crypto from "node:crypto";

const KMS_KEY_ARN = process.env.KMS_KEY_ARN;

/**
 * Require LOCAL_ENCRYPTION_KEY in all non-production environments.
 * Fail fast if missing — never fall back to a hardcoded value (Task 1.2).
 */
function getLocalEncryptionKey(): string {
  const key = process.env.LOCAL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "LOCAL_ENCRYPTION_KEY environment variable is required for local AES encryption. " +
        "Set it in .env.local (dev) or as a secure env var in CI.",
    );
  }
  return key;
}

// AES-256-GCM constants
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Encrypt a Stellar secret key using envelope encryption.
 *
 * Format (prod):  "kms:<base64>"
 * Format (dev):   "aes:<iv hex>:<tag hex>:<ciphertext hex>"
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  if (KMS_KEY_ARN) {
    return kmsEncrypt(plaintext);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "KMS_KEY_ARN must be set in production. Local AES encryption is not allowed in production.",
    );
  }

  logger.warn("[kms] Using local AES-256-GCM — NOT suitable for production.");
  return localEncrypt(plaintext);
}

/**
 * Decrypt an encrypted Stellar secret key.
 * Supports kms: and aes: prefixes only (legacy XOR removed — Task 1.2).
 */
export async function decryptSecret(ciphertext: string): Promise<string> {
  if (ciphertext.startsWith("kms:")) {
    return kmsDecrypt(ciphertext.slice(4));
  }
  if (ciphertext.startsWith("aes:")) {
    return localDecrypt(ciphertext.slice(4));
  }
  // Base64-encoded plain secret (Task 0.1 migration target) — readable for migration only.
  // After running migrate-escrow-keys.ts this branch will never trigger.
  logger.warn(
    "[kms] Decrypting legacy plain-base64 format — run migrate-escrow-keys.ts to re-encrypt.",
  );
  return Buffer.from(ciphertext, "base64").toString("utf-8");
}

// ─── AWS KMS ─────────────────────────────────────────────────────────────────

async function kmsEncrypt(plaintext: string): Promise<string> {
  try {
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
    logger.error("[kms] KMS encryption failed", { error: String(err) });
    throw new Error("Failed to encrypt secret with KMS");
  }
}

async function kmsDecrypt(ciphertextBase64: string): Promise<string> {
  try {
    const mod = await import("@aws-sdk/client-kms");
    const client = new mod.KMSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const command = new mod.DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertextBase64, "base64"),
    });
    const response = await client.send(command);
    if (!response.Plaintext) throw new Error("KMS returned empty Plaintext");
    return Buffer.from(response.Plaintext).toString("utf-8");
  } catch (err) {
    logger.error("[kms] KMS decryption failed", { error: String(err) });
    throw new Error("Failed to decrypt secret with KMS");
  }
}

// ─── Local AES-256-GCM (development only) ────────────────────────────────────

function deriveKey(): Buffer {
  const rawKey = getLocalEncryptionKey();
  const derived = crypto.hkdfSync(
    "sha256",
    rawKey,
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
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex!, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}
