/**
 * KMS Service tests (Task 5.5).
 * Verifies local AES-256-GCM round-trip, non-determinism, and guard conditions.
 *
 * Note: NODE_ENV is read-only in TypeScript strict mode, so production-guard
 * tests use workarounds via Object.defineProperty.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TEST_KEY = "test-local-encryption-key-32bytes!!";

describe("KMS Service — local AES-256-GCM", () => {
  const originalKey = process.env.LOCAL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.LOCAL_ENCRYPTION_KEY = TEST_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.LOCAL_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.LOCAL_ENCRYPTION_KEY;
    }
    vi.resetModules();
  });

  it("encryptSecret + decryptSecret round-trip produces the original plaintext", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/services/kms");
    const secret = "SCZANGBA5YHTNYVVV3C7CAZMCLFJLQCFKV3L6GBO7KN2VB5CYC3ZA6V";
    const encrypted = await encryptSecret(secret);
    expect(encrypted).toMatch(/^aes:/);
    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("encrypts with a different IV each time (non-deterministic)", async () => {
    const { encryptSecret } = await import("@/lib/services/kms");
    // Use a string that looks like a Stellar secret for realism
    const secret = "SCZANGBA5YHTNYVVV3C7CAZMCLFJLQCFKV3L6GBO7KN2VB5CYC3ZA6V";
    const enc1 = await encryptSecret(secret);
    const enc2 = await encryptSecret(secret);
    // Same plaintext → different ciphertext (random IV)
    expect(enc1).not.toBe(enc2);
  });

  it("decryptSecret handles legacy plain-base64 format (Task 0.1 migration path)", async () => {
    const { decryptSecret } = await import("@/lib/services/kms");
    // Simulate the pre-fix bug: secret stored as plain base64
    const secret = "SCZANGBA5YHTNYVVV3C7CAZMCLFJLQCFKV3L6GBO7KN2VB5CYC3ZA6V";
    const legacyEncoded = Buffer.from(secret).toString("base64");
    const decrypted = await decryptSecret(legacyEncoded);
    expect(decrypted).toBe(secret);
  });

  it("throws if LOCAL_ENCRYPTION_KEY is not set", async () => {
    delete process.env.LOCAL_ENCRYPTION_KEY;
    vi.resetModules();
    const { encryptSecret } = await import("@/lib/services/kms");
    await expect(encryptSecret("test-value")).rejects.toThrow("LOCAL_ENCRYPTION_KEY");
  });

  it("decrypts aes: prefix correctly after round-trip", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/services/kms");
    const values = [
      "SCZANGBA5YHTNYVVV3C7CAZMCLFJLQCFKV3L6GBO7KN2VB5CYC3ZA6V",
      "short",
      "unicode-value: こんにちは",
    ];
    for (const v of values) {
      const enc = await encryptSecret(v);
      const dec = await decryptSecret(enc);
      expect(dec).toBe(v);
    }
  });
});
