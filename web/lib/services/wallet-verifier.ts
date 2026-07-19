/**
 * Server-side wallet challenge-response verifier (Req 5.1-5.7, 25.4, 25.9, 33.15).
 *
 * Issues 32-byte nonce challenges with 5-minute expiry, verifies signatures
 * via Keypair.verify, and persists wallet as Verified only on success.
 */
import "server-only";

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

  // Verify signature using Stellar SDK
  // Dynamic import to keep @stellar/stellar-sdk out of middleware bundles
  const { Keypair } = await import("@stellar/stellar-sdk");

  const publicKey = challenge.claimed_public_key;
  const nonceBuffer = Buffer.from(challenge.nonce, "hex");
  const signatureBuffer = Buffer.from(signature, "base64");

  let verified = false;
  try {
    const keypair = Keypair.fromPublicKey(publicKey);
    verified = keypair.verify(nonceBuffer, signatureBuffer);
  } catch {
    verified = false;
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
  const { error: walletError } = await supabase.from("wallets").upsert(
    {
      user_id: userId,
      public_key: publicKey,
      provider: "Freighter", // Default; can be enhanced to accept provider param
      verification_status: "Verified",
      verified_at: new Date().toISOString(),
      network_mode: "testnet", // Default; determined at verification time
    },
    { onConflict: "user_id,public_key" },
  );

  if (walletError) {
    throw new Error(`Failed to update wallet verification status: ${walletError.message}`);
  }

  return { publicKey, verified: true };
}
