/**
 * GET /api/escrow/[id]/on-chain-state
 *
 * Returns live blockchain data for an escrow account:
 *   - On-chain contract balance from Soroban RPC
 *   - Most recent fund transaction (tx_hash, ledger, timestamp, amount, wallet)
 *   - Explorer URLs for contract, transaction, and wallet
 *   - DB vs on-chain consistency flag
 *
 * Used by the escrow funding page to surface real blockchain data without mocking.
 * All heavy lifting (RPC calls) is server-side — the client just fetches this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStellarClient } from "@/lib/stellar/client";
import { handleApiError } from "@/lib/errors";

const EXPLORER_CONTRACT_URLS: Record<string, string> = {
  testnet: "https://stellar.expert/explorer/testnet/contract",
  mainnet: "https://stellar.expert/explorer/public/contract",
};
const EXPLORER_ACCOUNT_URLS: Record<string, string> = {
  testnet: "https://stellar.expert/explorer/testnet/account",
  mainnet: "https://stellar.expert/explorer/public/account",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: escrowId } = await params;

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Fetch escrow from DB
    const { data: escrow } = await serviceClient
      .from("escrow_accounts")
      .select(
        "id, state, status, network, contract_address, stellar_public_key, expected_balance, last_reconciled_balance, inconsistent, event_id",
      )
      .eq("id", escrowId)
      .single();

    if (!escrow) {
      return NextResponse.json({ error: "Escrow not found." }, { status: 404 });
    }

    const stellar = getStellarClient();
    const network = (escrow.network ?? "testnet") as "testnet" | "mainnet";

    // Fetch the most recent confirmed fund transaction from DB
    const { data: latestFundTx } = await serviceClient
      .from("transactions")
      .select("tx_hash, amount, created_at, from_address, status")
      .eq("escrow_id", escrowId)
      .eq("type", "fund")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch live on-chain transaction details if we have a hash
    let onChainTx: {
      hash: string;
      ledger: number | null;
      createdAt: string | null;
      successful: boolean;
    } | null = null;

    if (latestFundTx?.tx_hash) {
      try {
        const txStatus = await stellar.getTransaction(latestFundTx.tx_hash);
        if (txStatus) {
          onChainTx = {
            hash: txStatus.hash,
            ledger: txStatus.ledger ?? null,
            createdAt: txStatus.createdAt ?? null,
            successful: txStatus.successful,
          };
        }
      } catch {
        // Non-blocking — tx may not be on Horizon yet
      }
    }

    // Fetch live on-chain balance from Horizon (most reliable source)
    let onChainBalance = "0";
    if (escrow.stellar_public_key) {
      try {
        onChainBalance = await stellar.getBalance(escrow.stellar_public_key);
      } catch {
        // Non-blocking
      }
    }

    // Build explorer URLs
    const contractBase = EXPLORER_CONTRACT_URLS[network] ?? EXPLORER_CONTRACT_URLS.testnet;
    const accountBase = EXPLORER_ACCOUNT_URLS[network] ?? EXPLORER_ACCOUNT_URLS.testnet;
    const txBase =
      network === "mainnet"
        ? "https://stellar.expert/explorer/public/tx"
        : "https://stellar.expert/explorer/testnet/tx";

    const explorerLinks = {
      contract: escrow.contract_address
        ? `${contractBase}/${escrow.contract_address}`
        : null,
      transaction: onChainTx?.hash ? `${txBase}/${onChainTx.hash}` : null,
      wallet: escrow.stellar_public_key
        ? `${accountBase}/${escrow.stellar_public_key}`
        : null,
    };

    return NextResponse.json({
      // DB state
      escrowId,
      dbState: escrow.state ?? escrow.status,
      expectedBalance: escrow.expected_balance,
      contractAddress: escrow.contract_address ?? null,
      walletAddress: escrow.stellar_public_key ?? null,
      network,
      inconsistent: escrow.inconsistent ?? false,

      // Live on-chain data
      onChainBalance,

      // Most recent fund transaction
      transaction: latestFundTx
        ? {
            hash: latestFundTx.tx_hash,
            amount: latestFundTx.amount,
            status: latestFundTx.status,
            recordedAt: latestFundTx.created_at,
            fromAddress: latestFundTx.from_address,
            // Live ledger data from Horizon if available
            ledger: onChainTx?.ledger ?? null,
            blockTimestamp: onChainTx?.createdAt ?? null,
            confirmed: onChainTx?.successful ?? false,
          }
        : null,

      // One-click explorer links
      explorerLinks,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
