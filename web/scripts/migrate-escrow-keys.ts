/**
 * One-time migration script: re-encrypt escrow secret keys (Task 1.2).
 *
 * Reads all escrow_accounts with non-prefixed (plain Base64 or legacy XOR hex)
 * encrypted_secret_key values, decrypts them with the old format, and
 * re-encrypts using encryptSecret() (AES-256-GCM or KMS).
 *
 * Run once on the target database:
 *   npx tsx scripts/migrate-escrow-keys.ts
 *
 * Safe to run multiple times — already-migrated rows (aes: or kms: prefix) are skipped.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../lib/services/kms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateEscrowKeys() {
  console.log("[migrate-escrow-keys] Fetching escrow accounts...");

  const { data: escrows, error } = await supabase
    .from("escrow_accounts")
    .select("id, encrypted_secret_key");

  if (error) {
    console.error("[migrate-escrow-keys] Failed to fetch accounts:", error.message);
    process.exit(1);
  }

  if (!escrows || escrows.length === 0) {
    console.log("[migrate-escrow-keys] No escrow accounts found. Nothing to migrate.");
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const escrow of escrows) {
    const raw = String(escrow.encrypted_secret_key ?? "");

    // Already migrated
    if (raw.startsWith("aes:") || raw.startsWith("kms:")) {
      skipped++;
      continue;
    }

    try {
      // Determine legacy format and decode
      let secretKey: string;

      if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 0) {
        // Plain Base64 (Task 0.1 bug — stored as base64 without encryption)
        secretKey = Buffer.from(raw, "base64").toString("utf-8");
      } else {
        // Unknown format — skip with warning
        console.warn(`[migrate-escrow-keys] Unknown format for escrow ${escrow.id} — skipping.`);
        failed++;
        continue;
      }

      // Validate it looks like a Stellar secret key
      if (!secretKey.startsWith("S") || secretKey.length !== 56) {
        console.warn(
          `[migrate-escrow-keys] Decoded value for ${escrow.id} does not look like a Stellar secret key — skipping.`,
        );
        failed++;
        continue;
      }

      // Re-encrypt
      const newEncrypted = await encryptSecret(secretKey);

      const { error: updateError } = await supabase
        .from("escrow_accounts")
        .update({ encrypted_secret_key: newEncrypted })
        .eq("id", escrow.id);

      if (updateError) {
        console.error(
          `[migrate-escrow-keys] Failed to update escrow ${escrow.id}:`,
          updateError.message,
        );
        failed++;
        continue;
      }

      console.log(`[migrate-escrow-keys] Migrated escrow ${escrow.id}`);
      migrated++;
    } catch (err) {
      console.error(`[migrate-escrow-keys] Error processing ${escrow.id}:`, String(err));
      failed++;
    }
  }

  console.log(
    `[migrate-escrow-keys] Done. Migrated: ${migrated}, Skipped (already encrypted): ${skipped}, Failed: ${failed}`,
  );

  if (failed > 0) {
    console.error("[migrate-escrow-keys] Some records failed — review output and re-run.");
    process.exit(1);
  }
}

migrateEscrowKeys();
