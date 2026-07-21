/**
 * Soroban Escrow Contract Client.
 *
 * Interfaces with the Stellar Guardian Escrow smart contract deployed on Soroban.
 * The contract handles:
 * - Escrow creation (initialize with organizer, event_id, prize_pool_target)
 * - Deposits (organizer funds the escrow)
 * - Disbursements (platform distributes to winners)
 * - Refunds (return funds to organizer on cancellation)
 * - State queries (balance, funding status, lock status)
 *
 * Contract Methods:
 * - initialize(organizer: Address, event_id: Bytes, target: i128)
 * - deposit(from: Address, amount: i128)
 * - disburse(recipients: Vec<Address>, amounts: Vec<i128>)
 * - refund(to: Address)
 * - get_balance() -> i128
 * - get_state() -> u32 (0=PendingFunding, 1=PartiallyFunded, 2=FullyFunded, 3=Locked, 4=Released, 5=Refunded)
 * - lock()
 * - is_locked() -> bool
 */
import "server-only";
import {
  Contract,
  Networks,
  TransactionBuilder,
  Operation,
  rpc as SorobanRpc,
  Keypair,
  Address,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { logger } from "@/lib/logger";
import { decryptSecret } from "@/lib/services/kms";

// Environment configuration
const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const ESCROW_CONTRACT_ID = process.env.ESCROW_CONTRACT_ID ?? "";
const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet";

const NETWORK_PASSPHRASE = STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/**
 * Get the Soroban RPC server instance.
 */
function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(SOROBAN_RPC_URL);
}

/**
 * Get the escrow Contract instance.
 */
function getEscrowContract(contractId?: string): Contract {
  const id = contractId || ESCROW_CONTRACT_ID;
  if (!id) {
    throw new Error("ESCROW_CONTRACT_ID environment variable is not set.");
  }
  return new Contract(id);
}

/**
 * Initialize a new escrow instance on the contract for an event.
 * Called when an event transitions to OrganizerFundsEscrow state.
 *
 * @param organizerPublicKey - The organizer's verified Stellar address
 * @param eventId - The event UUID
 * @param prizePoolTarget - Target amount in stroops (1 XLM = 10_000_000 stroops)
 * @param platformKeypair - Platform signing keypair (decrypted from KMS)
 */
export async function initializeEscrow(params: {
  organizerPublicKey: string;
  eventId: string;
  prizePoolTarget: bigint;
  platformSecretKey: string;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract();
    const keypair = Keypair.fromSecret(params.platformSecretKey);
    const sourceAccount = await server.getAccount(keypair.publicKey());

    // Build the contract invocation
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000000", // 0.1 XLM max fee for Soroban
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "initialize",
          new Address(params.organizerPublicKey).toScVal(),
          nativeToScVal(Buffer.from(params.eventId), { type: "bytes" }),
          nativeToScVal(params.prizePoolTarget, { type: "i128" }),
        ),
      )
      .setTimeout(300)
      .build();

    // Simulate to get resource requirements
    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }

    // Assemble with simulation results
    const assembled = SorobanRpc.assembleTransaction(tx, simulated).build();
    assembled.sign(keypair);

    // Submit
    const result = await server.sendTransaction(assembled);

    if (result.status === "ERROR") {
      throw new Error(
        `Transaction submission failed: ${result.errorResult?.toXDR("base64") ?? "unknown"}`,
      );
    }

    // Poll for completion
    const confirmed = await pollTransaction(server, result.hash);

    return { success: confirmed.success, txHash: result.hash };
  } catch (err) {
    logger.error("Soroban escrow initialization failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Build a deposit transaction XDR for the organizer to sign.
 * The organizer signs this with their Freighter wallet.
 *
 * @returns Unsigned transaction XDR (base64) for client-side signing
 */
export async function buildDepositTransaction(params: {
  organizerPublicKey: string;
  amount: bigint;
  contractId?: string;
}): Promise<{ xdr: string } | { error: string }> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(params.contractId);
    const sourceAccount = await server.getAccount(params.organizerPublicKey);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "deposit",
          new Address(params.organizerPublicKey).toScVal(),
          nativeToScVal(params.amount, { type: "i128" }),
        ),
      )
      .setTimeout(300)
      .build();

    // Simulate to get auth and footprint
    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      return { error: `Simulation failed: ${simulated.error}` };
    }

    const assembled = SorobanRpc.assembleTransaction(tx, simulated).build();

    // Return unsigned XDR for Freighter to sign
    return { xdr: assembled.toXDR() };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Execute disbursement via the Soroban contract.
 * Called by the platform after winners are finalized.
 *
 * @param recipients - Array of winner public keys
 * @param amounts - Corresponding prize amounts in stroops
 * @param platformSecretKey - Platform keypair for signing
 */
export async function executeSorobanDisbursement(params: {
  recipients: string[];
  amounts: bigint[];
  platformSecretKey: string;
  contractId?: string;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(params.contractId);
    const keypair = Keypair.fromSecret(params.platformSecretKey);
    const sourceAccount = await server.getAccount(keypair.publicKey());

    // Build ScVal arrays for recipients and amounts
    const recipientScVals = params.recipients.map((r) => new Address(r).toScVal());
    const amountScVals = params.amounts.map((a) => nativeToScVal(a, { type: "i128" }));

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "disburse",
          xdr.ScVal.scvVec(recipientScVals),
          xdr.ScVal.scvVec(amountScVals),
        ),
      )
      .setTimeout(300)
      .build();

    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }

    const assembled = SorobanRpc.assembleTransaction(tx, simulated).build();
    assembled.sign(keypair);

    const result = await server.sendTransaction(assembled);
    if (result.status === "ERROR") {
      throw new Error("Transaction submission failed");
    }

    const confirmed = await pollTransaction(server, result.hash);
    return { success: confirmed.success, txHash: result.hash };
  } catch (err) {
    logger.error("Soroban disbursement failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Execute refund via the Soroban contract.
 * Returns all funds to the organizer.
 */
export async function executeSorobanRefund(params: {
  organizerPublicKey: string;
  platformSecretKey: string;
  contractId?: string;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(params.contractId);
    const keypair = Keypair.fromSecret(params.platformSecretKey);
    const sourceAccount = await server.getAccount(keypair.publicKey());

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("refund", new Address(params.organizerPublicKey).toScVal()))
      .setTimeout(300)
      .build();

    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }

    const assembled = SorobanRpc.assembleTransaction(tx, simulated).build();
    assembled.sign(keypair);

    const result = await server.sendTransaction(assembled);
    if (result.status === "ERROR") {
      throw new Error("Transaction submission failed");
    }

    const confirmed = await pollTransaction(server, result.hash);
    return { success: confirmed.success, txHash: result.hash };
  } catch (err) {
    logger.error("Soroban refund failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Query the contract state (balance, lock status, etc.).
 */
export async function queryEscrowState(contractId?: string): Promise<{
  balance: bigint;
  state: number;
  isLocked: boolean;
} | null> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(contractId);
    const { scValToNative } = await import("@stellar/stellar-sdk");

    // Use a well-funded testnet account for simulation, or fall back to a fresh keypair
    const keypair = Keypair.random();
    let sourceAccount: Awaited<ReturnType<typeof server.getAccount>>;
    try {
      sourceAccount = await server.getAccount(keypair.publicKey());
    } catch {
      // Account not funded — cannot simulate
      return null;
    }

    // Query balance
    const balanceTx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("get_balance"))
      .setTimeout(30)
      .build();

    const balanceSim = await server.simulateTransaction(balanceTx);
    if (SorobanRpc.Api.isSimulationError(balanceSim)) return null;

    // Query state
    const stateTx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("get_state"))
      .setTimeout(30)
      .build();

    const stateSim = await server.simulateTransaction(stateTx);
    if (SorobanRpc.Api.isSimulationError(stateSim)) return null;

    // Query isLocked
    const lockTx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("is_locked"))
      .setTimeout(30)
      .build();

    const lockSim = await server.simulateTransaction(lockTx);

    // Parse ScVal results via scValToNative (Task 3.4 fix)
    const balanceResult = (balanceSim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result;
    const stateResult = (stateSim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result;
    const lockResult = !SorobanRpc.Api.isSimulationError(lockSim)
      ? (lockSim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result
      : undefined;

    const balance = balanceResult?.retval ? BigInt(scValToNative(balanceResult.retval)) : BigInt(0);

    const state = stateResult?.retval ? Number(scValToNative(stateResult.retval)) : 0;

    const isLocked = lockResult?.retval ? Boolean(scValToNative(lockResult.retval)) : false;

    return { balance, state, isLocked };
  } catch (err) {
    logger.error("Soroban state query failed", { error: String(err) });
    return null;
  }
}

/**
 * Poll for transaction confirmation.
 */
async function pollTransaction(
  server: SorobanRpc.Server,
  hash: string,
  maxAttempts = 30,
): Promise<{ success: boolean }> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await server.getTransaction(hash);
    if (status.status === "SUCCESS") {
      return { success: true };
    }
    if (status.status === "FAILED") {
      return { success: false };
    }
    // NOT_FOUND means still pending
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { success: false };
}
