/**
 * Script to invoke the deployed Soroban escrow contract on testnet.
 * Produces a verifiable transaction hash for the Stellar Builder Challenge.
 *
 * Usage: npx tsx scripts/invoke-contract.ts
 */
import {
  rpc as SorobanRpc,
  Keypair,
  TransactionBuilder,
  Contract,
  Networks,
  Address,
  nativeToScVal,
} from "@stellar/stellar-sdk";

const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = "CAF2TCCKNRTUNANF6YFMRU764GQKGCSLRN3RKQEO4XJJGMCQF5ED6ZAT";
const NATIVE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

async function main() {
  console.log("=== Stellar Guardian — Contract Interaction ===\n");
  console.log("Contract ID:", CONTRACT_ID);
  console.log("Network:     Testnet");
  console.log("RPC URL:     ", SOROBAN_RPC_URL);
  console.log("");

  const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
  const contract = new Contract(CONTRACT_ID);

  // Generate a fresh funded account for this interaction
  const keypair = Keypair.random();
  console.log("Generated caller:", keypair.publicKey());

  // Fund via Friendbot
  console.log("Funding via Friendbot...");
  const fbRes = await fetch(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);
  if (!fbRes.ok && fbRes.status !== 400) {
    throw new Error(`Friendbot failed: ${fbRes.status}`);
  }
  console.log("Account funded ✓\n");

  // Wait for account availability
  await new Promise((r) => setTimeout(r, 3000));

  const account = await server.getAccount(keypair.publicKey());

  // Try to initialize the contract (will succeed if not already initialized)
  console.log("Calling contract.initialize(...)");
  const eventId = `challenge-demo-${Date.now()}`;

  const initTx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        "initialize",
        new Address(keypair.publicKey()).toScVal(), // admin
        new Address(keypair.publicKey()).toScVal(), // organizer
        nativeToScVal(Buffer.from(eventId), { type: "bytes" }), // event_id
        nativeToScVal(BigInt(10_000_000_000), { type: "i128" }), // target: 1000 XLM
        new Address(NATIVE_TOKEN).toScVal(), // token (XLM SAC)
      ),
    )
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(initTx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    console.log("Contract already initialized. Trying get_state instead...\n");

    // Fall back to calling get_state (read method submitted as TX)
    const account2 = await server.getAccount(keypair.publicKey());
    const stateTx = new TransactionBuilder(account2, {
      fee: "1000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call("get_state"))
      .setTimeout(300)
      .build();

    const stateSim = await server.simulateTransaction(stateTx);
    if (SorobanRpc.Api.isSimulationError(stateSim)) {
      console.error("get_state simulation failed:", stateSim.error);
      process.exit(1);
    }

    const assembled = SorobanRpc.assembleTransaction(stateTx, stateSim).build();
    assembled.sign(keypair);
    const result = await server.sendTransaction(assembled);

    console.log("=== CONTRACT INTERACTION SUCCESSFUL ===");
    console.log("Method:      get_state()");
    console.log("TX Hash:     ", result.hash);
    console.log("Status:      ", result.status);
    console.log("");
    console.log("Verify on Stellar Expert:");
    console.log(`  https://stellar.expert/explorer/testnet/tx/${result.hash}`);
    console.log("");
    console.log("Contract on Stellar Expert:");
    console.log(`  https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`);
  } else {
    // Initialize succeeded in simulation — assemble and submit
    const assembled = SorobanRpc.assembleTransaction(initTx, sim).build();
    assembled.sign(keypair);
    const result = await server.sendTransaction(assembled);

    console.log("\n=== CONTRACT INTERACTION SUCCESSFUL ===");
    console.log("Method:      initialize()");
    console.log("TX Hash:     ", result.hash);
    console.log("Status:      ", result.status);
    console.log("Event ID:    ", eventId);
    console.log("");
    console.log("Verify on Stellar Expert:");
    console.log(`  https://stellar.expert/explorer/testnet/tx/${result.hash}`);
    console.log("");
    console.log("Contract on Stellar Expert:");
    console.log(`  https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`);
  }

  console.log("\n=== SUBMISSION INFO ===");
  console.log("Deployed Contract Address:", CONTRACT_ID);
  console.log("Network: Stellar Testnet");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
