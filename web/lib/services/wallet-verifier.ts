/**
 * Server-side wallet challenge-response verifier (Req 5.1-5.7, 25.4, 25.9, 33.15).
 *
 * Uses a SEP-10-inspired approach: issues a challenge as a Stellar transaction
 * with a ManageData operation containing the nonce. The wallet signs the TX,
 * and we verify the transaction signature — this works reliably with ALL
 * Stellar wallets (Freighter, xBull, LOBSTR, Albedo, Rabet).
 *
 * Previous approach using signMessage/SUBMIT_BLOB failed because Freighter v6
 * wraps blobs in a structured XDR envelope before signing, making server-side
 * verification of raw bytes impossible without replicating the exact internal format.
 */
import "server-only";

import { Keypair, Networks, TransactionBuilder, Operation, Account } from "@stellar/stellar-sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";

/** Challenge expiry window in minutes (Req 5.1). */
const CHALLENGE_EXPIRY_MINUTES = 5;

const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_MODE === "mainnet"
  ? Networks.PUBLIC
  : Networks.TESTNET;

/**
 * Issue a wallet verification challenge.
 *
 * Generates a random 32-byte nonce and builds an unsigned challenge transaction
 * (a ManageData operation with the nonce). The wallet signs this TX to prove ownership.
 */
export async function issueChallenge(
  userId: string,
  claimedPublicKey: string,
): Promise<{ challengeId: string; nonce: string; transaction: string }> {
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

  // Build a challenge transaction (SEP-10 inspired).
  // Use a fake sequence number (0) — this TX is never submitted to the network.
  const challengeAccount = new Account(claimedPublicKey, "0");
  const challengeTx = new TransactionBuilder(challengeAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.manageData({
        name: "stellar_guardian_auth",
        value: Buffer.from(nonceHex, "utf8"),
        source: claimedPublicKey,
      }),
    )
    .setTimeout(CHALLENGE_EXPIRY_MINUTES * 60)
    .build();

  const challengeXdr = challengeTx.toXDR();

  const { data, error } = await supabase
    .from("wallet_challenges")
    .insert({
      user_id: userId,
      claimed_public_key: claimedPublicKey,
      nonce: Buffer.from(nonceHex, "hex"), // bytea column
      nonce_hex: nonceHex,
      challenge_xdr: challengeXdr,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create wallet challenge: ${error.message}`);
  }

  return { challengeId: data.id, nonce: nonceHex, transaction: challengeXdr };
}

/**
 * Verify a wallet challenge-response.
 *
 * The client signs the challenge transaction with their wallet (signTransaction).
 * We verify the TX signature matches the claimed public key.
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

  const publicKey = challenge.claimed_public_key;

  // The `signature` here is the signed transaction XDR returned by the wallet's signTransaction.
  // Parse it and verify the signature matches the claimed public key.
  let verified = false;
  try {
    const signedTx = TransactionBuilder.fromXDR(signature, NETWORK_PASSPHRASE);
    const keypair = Keypair.fromPublicKey(publicKey);

    // Get the transaction hash (what was actually signed)
    const txHash = signedTx.hash();

    // Check if any signature on the TX was produced by the claimed public key
    for (const sig of signedTx.signatures) {
      try {
        if (keypair.verify(txHash, sig.signature())) {
          verified = true;
          break;
        }
      } catch {
        // Continue checking other signatures
      }
    }
  } catch (err) {
    // If XDR parsing fails, the signature is invalid
    throw new BadRequestError("Signature verification failed. Invalid signed transaction format.", {
      code: "SIGNATURE_INVALID",
    });
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
