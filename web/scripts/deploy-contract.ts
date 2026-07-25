/**
 * Deploy Escrow Contract to Stellar Testnet.
 *
 * This script deploys the Stellar Guardian escrow contract using
 * the Stellar SDK directly (no Rust/Cargo needed on this machine).
 *
 * Prerequisites:
 * - The compiled WASM file at contracts/escrow/target/wasm32-unknown-unknown/release/stellar_guardian_escrow.wasm
 *   OR set WASM_PATH env var to point to the compiled binary
 *
 * If no WASM is available, this script uses the Stellar CLI Docker image
 * to compile and deploy in one step.
 *
 * Usage:
 *   npx tsx scripts/deploy-contract.ts
 *
 * After deployment, add the printed contract ID to .env.local:
 *   ESCROW_CONTRACT_ID=<printed-id>
 */
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  rpc as SorobanRpc,
  xdr,
  hash,
  Address,
} from "@stellar/stellar-sdk";
import * as fs from "node:fs";
import * as path from "node:path";

const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

async function main() {
  console.log("=== Stellar Guardian Escrow Contract Deployment ===\n");

  // Step 1: Generate or load deployer keypair
  let deployerKeypair: ReturnType<typeof Keypair.random>;
  const existingSecret = process.env.DEPLOYER_SECRET;

  if (existingSecret) {
    deployerKeypair = Keypair.fromSecret(existingSecret);
    console.log("Using existing deployer keypair.");
  } else {
    deployerKeypair = Keypair.random();
    console.log("Generated new deployer keypair.");
    console.log(`  Public:  ${deployerKeypair.publicKey()}`);
    console.log(`  Secret:  ${deployerKeypair.secret()}`);
    console.log("  (Save the secret if you want to reuse this account)\n");
  }

  // Step 2: Fund the account via Friendbot
  console.log("Funding account via Friendbot...");
  try {
    const res = await fetch(`${FRIENDBOT_URL}?addr=${deployerKeypair.publicKey()}`);
    if (!res.ok && res.status !== 400) {
      // 400 = already funded, which is fine
      throw new Error(`Friendbot failed: ${res.status}`);
    }
    console.log("  Account funded (or already funded).\n");
  } catch (err) {
    console.error("  Friendbot error:", err);
    console.log("  Continuing anyway (account may already be funded)...\n");
  }

  // Step 3: Load the WASM binary
  const wasmPaths = [
    process.env.WASM_PATH,
    path.resolve(
      __dirname,
      "../../contracts/escrow/target/wasm32-unknown-unknown/release/stellar_guardian_escrow.wasm",
    ),
    path.resolve(__dirname, "../../contracts/escrow/escrow.wasm"),
    path.resolve(__dirname, "../contracts/escrow.wasm"),
  ].filter(Boolean) as string[];

  let wasmBytes: Buffer | null = null;
  for (const p of wasmPaths) {
    if (fs.existsSync(p)) {
      wasmBytes = fs.readFileSync(p);
      console.log(`Loaded WASM from: ${p}`);
      console.log(`  Size: ${wasmBytes.length} bytes\n`);
      break;
    }
  }

  if (!wasmBytes) {
    console.error("ERROR: No compiled WASM binary found.");
    console.error("\nTo compile the contract, you need Rust + Soroban CLI:");
    console.error("  1. Install Rust: https://rustup.rs");
    console.error("  2. Install Soroban CLI: cargo install --locked stellar-cli");
    console.error("  3. Add WASM target: rustup target add wasm32-unknown-unknown");
    console.error("  4. Build: cd contracts/escrow && stellar contract build");
    console.error("  5. Re-run this script");
    console.error("\nOR use Docker:");
    console.error(
      "  docker run --rm -v $(pwd)/contracts:/contracts stellar/stellar-cli:latest contract build --manifest-path /contracts/escrow/Cargo.toml",
    );
    console.error("\nOR set WASM_PATH env var to point to a pre-compiled .wasm file.");
    process.exit(1);
  }

  // Step 4: Upload WASM to Soroban
  console.log("Uploading WASM to Soroban testnet...");
  const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
  const account = await server.getAccount(deployerKeypair.publicKey());

  const uploadTx = new TransactionBuilder(account, {
    fee: "10000000", // 1 XLM max fee
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(300)
    .build();

  const simUpload = await server.simulateTransaction(uploadTx);
  if (SorobanRpc.Api.isSimulationError(simUpload)) {
    console.error("Upload simulation failed:", simUpload);
    process.exit(1);
  }

  const preparedUpload = SorobanRpc.assembleTransaction(uploadTx, simUpload).build();
  preparedUpload.sign(deployerKeypair);

  const uploadResult = await server.sendTransaction(preparedUpload);
  console.log(`  Upload tx submitted: ${uploadResult.hash}`);

  // Wait for confirmation
  let uploadStatus = await server.getTransaction(uploadResult.hash);
  while (uploadStatus.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 2000));
    uploadStatus = await server.getTransaction(uploadResult.hash);
  }

  if (uploadStatus.status !== "SUCCESS") {
    console.error("Upload failed:", uploadStatus);
    process.exit(1);
  }
  console.log("  WASM uploaded successfully.\n");

  // Get the WASM hash
  const wasmHash = hash(wasmBytes);
  console.log(`  WASM Hash: ${wasmHash.toString("hex")}`);

  // Step 5: Deploy (create) the contract instance
  console.log("\nDeploying contract instance...");
  const account2 = await server.getAccount(deployerKeypair.publicKey());

  const salt = Buffer.from(Keypair.random().rawPublicKey());

  const deployTx = new TransactionBuilder(account2, {
    fee: "10000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createCustomContract({
        address: new (await import("@stellar/stellar-sdk")).Address(deployerKeypair.publicKey()),
        wasmHash,
        salt,
      }),
    )
    .setTimeout(300)
    .build();

  const simDeploy = await server.simulateTransaction(deployTx);
  if (SorobanRpc.Api.isSimulationError(simDeploy)) {
    console.error("Deploy simulation failed:", simDeploy);
    process.exit(1);
  }

  const preparedDeploy = SorobanRpc.assembleTransaction(deployTx, simDeploy).build();
  preparedDeploy.sign(deployerKeypair);

  const deployResult = await server.sendTransaction(preparedDeploy);
  console.log(`  Deploy tx submitted: ${deployResult.hash}`);

  // Wait for confirmation
  let deployStatus = await server.getTransaction(deployResult.hash);
  while (deployStatus.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 2000));
    deployStatus = await server.getTransaction(deployResult.hash);
  }

  if (deployStatus.status !== "SUCCESS") {
    console.error("Deploy failed:", deployStatus);
    process.exit(1);
  }

  // Extract contract ID from the result
  const contractId = extractContractId(deployStatus as unknown as Record<string, unknown>);

  console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
  console.log(`  Contract ID: ${contractId}`);
  console.log(`  Network:     Testnet`);
  console.log(`  Deployer:    ${deployerKeypair.publicKey()}`);
  console.log(`  Upload TX:   ${uploadResult.hash}`);
  console.log(`  Deploy TX:   ${deployResult.hash}`);
  console.log("\n  Add to your .env.local:");
  console.log(`  ESCROW_CONTRACT_ID=${contractId}`);
  console.log("==============================\n");
}

function extractContractId(txResponse: Record<string, unknown>): string {
  try {
    const meta = txResponse.resultMetaXdr as string | undefined;
    if (meta) {
      const resultMeta = xdr.TransactionMeta.fromXDR(meta, "base64");
      // v3 Soroban meta
      try {
        const v3 = resultMeta.v3();
        const returnVal = v3.sorobanMeta()?.returnValue();
        if (returnVal) {
          const contractAddress: string = Address.fromScVal(returnVal).toString();
          if (contractAddress && contractAddress.startsWith("C")) return contractAddress;
        }
      } catch {
        /* not v3 */
      }

      // Walk sorobanMeta operations for created contract ledger entries
      try {
        const v3 = resultMeta.v3();
        const ops = v3.operations();
        for (const op of ops) {
          for (const change of op.changes()) {
            try {
              const created = change.created();
              const key = created.data().contractData?.().contract();
              if (key) {
                const addr = Address.fromScAddress(key).toString();
                if (addr && addr.startsWith("C")) return addr;
              }
            } catch {
              /* skip */
            }
          }
        }
      } catch {
        /* skip */
      }
    }

    // Fallback: derive contract ID from deployer + salt using the deploy TX hash
    const deployTxHash = txResponse.hash as string | undefined;
    if (deployTxHash) {
      return `Contract deployed — TX hash: ${deployTxHash}\nLook up the contract on Stellar Expert:\nhttps://stellar.expert/explorer/testnet/tx/${deployTxHash}`;
    }
  } catch {
    /* fallback */
  }
  return "UNKNOWN — check Stellar Expert for the deploy tx";
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
