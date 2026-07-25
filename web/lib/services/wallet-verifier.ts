/**
 * Server-side wallet challenge-response verifier (Req 5.1-5.7, 25.4, 25.9, 33.15).
 *
 * Issues 32-byte nonce challenges with 5-minute expiry, verifies signatures
 * via Keypair.verify, and persists wallet as Verified only on success.
 */
import "server-only";

import { Keypair } from "@stellar/stellar-sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";

/** Challenge expiry window in minutes (Req 5.1). */
const CHALLENGE_EXPIRY_MINUTES = 5;

/**
 * Issue a wallet verification challenge.
 *
 * Generates a random 32-byte nonce, stores it server-side with a 5-minute
 * expiry keyed to the user + claimed address (Req 5.1, 5.5).
 */
export async function issueChallenge(
  userId: string,
  claimedPublicKey: string,
): Promise<{ challengeId: string; nonce: string }> {
  // Validate Stellar public key format
  if (!/^G[A-Z2-7]{55}$/.test(claimedPublicKey)) {
    throw new BadRequestError("Invalid Stellar public key format.");
  }

  const supabase = createServiceClient();

  // Generate 32-byte random nonce
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonceHex = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("wallet_challenges")
    .insert({
      user_id: userId,
      claimed_public_key: claimedPublicKey,
      nonce: nonceHex,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create wallet challenge: ${error.message}`);
  }

  return { challengeId: data.id, nonce: nonceHex };
}

/**
 * Verify a wallet challenge-response.
 *
 * Checks nonce freshness, verifies the signature via the Stellar SDK's
 * Keypair.verify, and persists the wallet as Verified on success (Req 5.2-5.7).
 */
export async function verifyChallenge(
  userId: string,
  challengeId: string,
  signature: string,
  options?: { provider?: string; networkMode?: string },
): Promise<{ publicKey: string; verified: boolean }> {
  const supabase = createServiceClient();

  // Fetch the challenge
  const { data: challenge, error: fetchError } = await supabase
    .from("wallet_challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !challenge) {
    throw new NotFoundError("Challenge not found or does not belong to this user.");
  }

  // Check expiry (Req 5.5)
  if (new Date(challenge.expires_at) < new Date()) {
    throw new BadRequestError(
      "Challenge has expired. Please request a fresh challenge.",
      { code: "CHALLENGE_EXPIRED" },
    );
  }

  // Check if already consumed
  if (challenge.consumed_at) {
    throw new ConflictError("This challenge has already been used.");
  }

  // Verify signature using Stellar SDK (imported at top of file)
  const publicKey = challenge.claimed_public_key;
  const signatureBuffer = Buffer.from(signature, "base64");

  // Freighter may sign the message in different formats depending on version:
  // 1. UTF-8 bytes of the hex nonce string (signMessage gets the hex string directly)
  // 2. Raw hex-decoded bytes of the nonce
  // We try both approaches for compatibility.
  const keypair = Keypair.fromPublicKey(publicKey);
  const messageCandidates = [
    Buffer.from(challenge.nonce, "utf8"),  // UTF-8 of hex string
    Buffer.from(challenge.nonce, "hex"),    // Raw bytes the hex represents
  ];

  let verified = false;
  for (const messageBuffer of messageCandidates) {
    try {
      if (keypair.verify(messageBuffer, signatureBuffer)) {
        verified = true;
        break;
      }
    } catch {
      // Try next candidate
    }
  }

  // Also try if signature was sent as hex instead of base64
  if (!verified) {
    try {
      const sigHex = Buffer.from(signature, "hex");
      for (const messageBuffer of messageCandidates) {
        try {
          if (keypair.verify(messageBuffer, sigHex)) {
            verified = true;
            break;
          }
        } catch {
          // continue
        }
      }
    } catch {
      // Signature not valid hex either
    }
  }

  if (!verified) {
    throw new BadRequestError("Signature verification failed.", {
      code: "SIGNATURE_INVALID",
    });
  }

  // Mark challenge as consumed
  await supabase
    .from("wallet_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challengeId);

  // Upsert wallet record as Verified (Req 5.6)
  const walletProvider = options?.provider ?? "Freighter";
  const walletNetwork = options?.networkMode ?? (process.env.STELLAR_NETWORK_MODE ?? "testnet");

  const { error: walletError } = await supabase.from("wallets").upsert(
    {
      user_id: userId,
      public_key: publicKey,
      provider: walletProvider,
      verification_status: "Verified",
      verified_at: new Date().toISOString(),
      network_mode: walletNetwork,
    },
    { onConflict: "user_id,public_key" },
  );

  if (walletError) {
    throw new Error(`Failed to update wallet verification status: ${walletError.message}`);
  }

  return { publicKey, verified: true };
}
