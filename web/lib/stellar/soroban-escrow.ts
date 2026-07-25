/**
 * Soroban Escrow Contract Client (server-only).
 *
 * Interfaces with the deployed Stellar Guardian Escrow smart contract.
 *
 * Contract ID: see ESCROW_CONTRACT_ID env var
 * Network:     testnet (STELLAR_NETWORK_MODE=testnet) or mainnet
 *
 * Contract lifecycle (matches lib.rs):
 *   initialize → deposit / admin_deposit → lock → disburse_batch (N times)
 *   → finalize  OR  refund (any pre-Released state)
 *
 * IMPORTANT: All methods are server-only. Client-side code interacts via
 * API routes which call these functions. Never expose contract secrets to
 * the browser.
 */
import "server-only";
import {
  Contract,
  Networks,
  TransactionBuilder,
  rpc as SorobanRpc,
  Keypair,
  Address,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { logger } from "@/lib/logger";

// ─── Environment Configuration ────────────────────────────────────────────────

const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const ESCROW_CONTRACT_ID = process.env.ESCROW_CONTRACT_ID ?? "";
const STELLAR_NETWORK = process.env.STELLAR_NETWORK_MODE ?? "testnet";

/** XLM native token contract on testnet (SEP-41 wrapped native) */
const NATIVE_TOKEN_TESTNET = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
/** XLM native token contract on mainnet */
const NATIVE_TOKEN_MAINNET = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

const NETWORK_PASSPHRASE = STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(SOROBAN_RPC_URL);
}

function getEscrowContract(contractId?: string): Contract {
  const id = contractId ?? ESCROW_CONTRACT_ID;
  if (!id) {
    throw new Error(
      "ESCROW_CONTRACT_ID environment variable is not set. " +
        "Run `npx tsx scripts/deploy-contract.ts` then set ESCROW_CONTRACT_ID in .env.local.",
    );
  }
  return new Contract(id);
}

function getNativeTokenAddress(): string {
  return STELLAR_NETWORK === "mainnet" ? NATIVE_TOKEN_MAINNET : NATIVE_TOKEN_TESTNET;
}

/**
 * Poll for transaction confirmation with exponential backoff.
 * Uses the built-in SDK `pollTransaction` when available, falls back to manual loop.
 */
async function pollForConfirmation(
  server: SorobanRpc.Server,
  hash: string,
  maxAttempts = 30,
): Promise<{ success: boolean; resultXdr?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await server.getTransaction(hash);
    if (status.status === "SUCCESS") {
      return { success: true, resultXdr: (status as SorobanRpc.Api.GetSuccessfulTransactionResponse).resultXdr?.toXDR("base64") };
    }
    if (status.status === "FAILED") {
      logger.warn("[soroban] Transaction failed", { hash });
      return { success: false };
    }
    // NOT_FOUND or PENDING — still processing
    await new Promise((r) => setTimeout(r, 2000));
  }
  logger.warn("[soroban] Transaction confirmation timed out", { hash, maxAttempts });
  return { success: false };
}

/**
 * Simulate, assemble, sign with keypair, and submit a transaction.
 * Returns the tx hash and success status.
 */
async function simulateSignSubmit(
  server: SorobanRpc.Server,
  tx: ReturnType<TransactionBuilder["build"]>,
  keypair: ReturnType<typeof Keypair.fromSecret>,
): Promise<{ hash: string; success: boolean }> {
  const simulated = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, simulated).build();
  assembled.sign(keypair);

  const result = await server.sendTransaction(assembled);
  if (result.status === "ERROR") {
    const errXdr = result.errorResult?.toXDR("base64") ?? "unknown";
    throw new Error(`Transaction submission failed: ${errXdr}`);
  }

  const confirmed = await pollForConfirmation(server, result.hash);
  return { hash: result.hash, success: confirmed.success };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize a new escrow instance on the contract for an event.
 *
 * Called when an event transitions to OrganizerFundsEscrow state.
 * The platform admin keypair is the `admin` parameter.
 *
 * Rust signature:
 *   initialize(admin, organizer, event_id, target, token)
 */
export async function initializeEscrow(params: {
  organizerPublicKey: string;
  eventId: string;
  /** Target amount in stroops (1 XLM = 10_000_000 stroops) */
  prizePoolTarget: bigint;
  platformSecretKey: string;
  contractId?: string;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(params.contractId);
    const keypair = Keypair.fromSecret(params.platformSecretKey);
    const sourceAccount = await server.getAccount(keypair.publicKey());

    const tokenAddress = getNativeTokenAddress();

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000000", // 0.1 XLM max fee for Soroban
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "initialize",
          new Address(keypair.publicKey()).toScVal(),    // admin = platform keypair
          new Address(params.organizerPublicKey).toScVal(), // organizer
          nativeToScVal(Buffer.from(params.eventId), { type: "bytes" }), // event_id
          nativeToScVal(params.prizePoolTarget, { type: "i128" }),        // target
          new Address(tokenAddress).toScVal(),           // token (XLM SAC)
        ),
      )
      .setTimeout(300)
      .build();

    const { hash, success } = await simulateSignSubmit(server, tx, keypair);
    logger.info("[soroban] initializeEscrow", { eventId: params.eventId, txHash: hash, success });
    return { success, txHash: hash };
  } catch (err) {
    logger.error("[soroban] initializeEscrow failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Build a deposit transaction XDR for the organizer to sign client-side.
 *
 * The organizer uses their Freighter/xBull/LOBSTR wallet to sign this.
 * Returns unsigned (assembled) XDR for the wallet to sign.
 *
 * Rust function: deposit(from: Address, amount: i128)
 */
export async function buildDepositTransaction(params: {
  organizerPublicKey: string;
  /** Amount in stroops */
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

    // Simulate to get auth + footprint — required before user signs
    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      return { error: `Simulation failed: ${simulated.error}` };
    }

    const assembled = SorobanRpc.assembleTransaction(tx, simulated).build();
    return { xdr: assembled.toXDR() };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Build an admin_deposit transaction XDR for a sponsor to sign client-side.
 *
 * Used when someone other than the organizer funds the escrow.
 * The platform admin must also sign (handled server-side after user signs).
 *
 * Rust function: admin_deposit(from: Address, amount: i128)
 */
export async function buildAdminDepositTransaction(params: {
  fromPublicKey: string;
  amount: bigint;
  platformSecretKey: string;
  contractId?: string;
}): Promise<{ xdr: string } | { error: string }> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(params.contractId);
    const platformKeypair = Keypair.fromSecret(params.platformSecretKey);
    const sourceAccount = await server.getAccount(params.fromPublicKey);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "admin_deposit",
          new Address(params.fromPublicKey).toScVal(),
          nativeToScVal(params.amount, { type: "i128" }),
        ),
      )
      .setTimeout(300)
      .build();

    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      return { error: `Simulation failed: ${simulated.error}` };
    }

    // Assemble and pre-sign with platform key (admin auth)
    // The user (from) also needs to sign — their signature is added client-side
    const assembled = SorobanRpc.assembleTransaction(tx, simulated).build();
    assembled.sign(platformKeypair);
    return { xdr: assembled.toXDR() };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Lock the escrow — platform admin only, must be FullyFunded.
 *
 * Rust function: lock()
 */
export async function lockEscrow(params: {
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
      .addOperation(contract.call("lock"))
      .setTimeout(300)
      .build();

    const { hash, success } = await simulateSignSubmit(server, tx, keypair);
    return { success, txHash: hash };
  } catch (err) {
    logger.error("[soroban] lockEscrow failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Execute a disbursement batch via the Soroban contract.
 *
 * Call multiple times for >N recipients. Finish with finalizeDisbursement().
 * Rust function: disburse_batch(recipients: Vec<Address>, amounts: Vec<i128>)
 */
export async function executeSorobanDisbursementBatch(params: {
  recipients: string[];
  /** Amounts in stroops, parallel to recipients */
  amounts: bigint[];
  platformSecretKey: string;
  contractId?: string;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(params.contractId);
    const keypair = Keypair.fromSecret(params.platformSecretKey);
    const sourceAccount = await server.getAccount(keypair.publicKey());

    const recipientScVals = params.recipients.map((r) => new Address(r).toScVal());
    const amountScVals = params.amounts.map((a) => nativeToScVal(a, { type: "i128" }));

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "disburse_batch",
          xdr.ScVal.scvVec(recipientScVals),
          xdr.ScVal.scvVec(amountScVals),
        ),
      )
      .setTimeout(300)
      .build();

    const { hash, success } = await simulateSignSubmit(server, tx, keypair);
    return { success, txHash: hash };
  } catch (err) {
    logger.error("[soroban] executeSorobanDisbursementBatch failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Finalize disbursement — transitions contract state to Released.
 * Must be called after all disburse_batch calls complete.
 *
 * Rust function: finalize()
 */
export async function finalizeDisbursement(params: {
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
      .addOperation(contract.call("finalize"))
      .setTimeout(300)
      .build();

    const { hash, success } = await simulateSignSubmit(server, tx, keypair);
    return { success, txHash: hash };
  } catch (err) {
    logger.error("[soroban] finalizeDisbursement failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Execute refund via the Soroban contract.
 * Returns all funds to the organizer.
 *
 * Rust function: refund()
 */
export async function executeSorobanRefund(params: {
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
      .addOperation(contract.call("refund"))
      .setTimeout(300)
      .build();

    const { hash, success } = await simulateSignSubmit(server, tx, keypair);
    return { success, txHash: hash };
  } catch (err) {
    logger.error("[soroban] executeSorobanRefund failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Query the contract state (balance, lock status, disbursed total).
 *
 * Uses the platform keypair as simulation source (must be funded).
 * Falls back to null if RPC unavailable or contract not initialized.
 */
export async function queryEscrowState(
  platformSecretKey?: string,
  contractId?: string,
): Promise<{
  balance: bigint;
  state: number;
  isLocked: boolean;
  target: bigint;
  disbursedTotal: bigint;
} | null> {
  try {
    const server = getRpcServer();
    const contract = getEscrowContract(contractId);
    const { scValToNative } = await import("@stellar/stellar-sdk");

    // Use the platform keypair as simulation source — it must be funded
    // (Freighter/random accounts are NOT funded and will fail)
    let sourcePublicKey: string;
    if (platformSecretKey) {
      sourcePublicKey = Keypair.fromSecret(platformSecretKey).publicKey();
    } else {
      // Fallback: try platform escrow key from env
      const envSecret = process.env.STELLAR_ESCROW_SECRET;
      if (!envSecret) return null;
      sourcePublicKey = Keypair.fromSecret(envSecret).publicKey();
    }

    const sourceAccount = await server.getAccount(sourcePublicKey);

    /** Helper to simulate a single read-only contract call */
    async function simulateRead(method: string): Promise<SorobanRpc.Api.SimulateTransactionSuccessResponse | null> {
      const tx = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(method))
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (SorobanRpc.Api.isSimulationError(sim)) return null;
      return sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    }

    const [balanceSim, stateSim, lockedSim, targetSim, disbursedSim] = await Promise.all([
      simulateRead("get_balance"),
      simulateRead("get_state"),
      simulateRead("is_locked"),
      simulateRead("get_target"),
      simulateRead("get_disbursed_total"),
    ]);

    if (!balanceSim || !stateSim) return null;

    const balance = balanceSim.result?.retval
      ? BigInt(scValToNative(balanceSim.result.retval) as number | bigint)
      : BigInt(0);
    const state = stateSim.result?.retval
      ? Number(scValToNative(stateSim.result.retval))
      : 0;
    const isLocked = lockedSim?.result?.retval
      ? Boolean(scValToNative(lockedSim.result.retval))
      : false;
    const target = targetSim?.result?.retval
      ? BigInt(scValToNative(targetSim.result.retval) as number | bigint)
      : BigInt(0);
    const disbursedTotal = disbursedSim?.result?.retval
      ? BigInt(scValToNative(disbursedSim.result.retval) as number | bigint)
      : BigInt(0);

    return { balance, state, isLocked, target, disbursedTotal };
  } catch (err) {
    logger.error("[soroban] queryEscrowState failed (non-blocking)", { error: String(err) });
    return null;
  }
}

/**
 * Fetch recent contract events for real-time sync.
 *
 * Events emitted by the contract: deposit, sponsor, locked, batch, disburse, finalize, refund
 *
 * Uses the Soroban RPC getEvents endpoint. Returns events since `startLedger`.
 */
export async function getContractEvents(params: {
  contractId?: string;
  startLedger?: number;
  limit?: number;
}): Promise<Array<{
  id: string;
  type: string;
  ledger: number;
  createdAt: string;
  topics: string[];
  value: unknown;
}>> {
  try {
    const server = getRpcServer();
    const contractId = params.contractId ?? ESCROW_CONTRACT_ID;
    if (!contractId) return [];

    // Get the latest ledger to calculate startLedger if not provided
    const latestLedger = await server.getLatestLedger();
    const startLedger = params.startLedger ?? Math.max(1, latestLedger.sequence - 1000);

    const { scValToNative } = await import("@stellar/stellar-sdk");

    const response = await server.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
        },
      ],
      limit: params.limit ?? 100,
    });

    return response.events.map((event) => ({
      id: event.id,
      type: event.type,
      ledger: event.ledger,
      createdAt: (event as unknown as Record<string, unknown>).createdAt as string ?? new Date().toISOString(),
      topics: event.topic.map((t) => {
        try {
          return String(scValToNative(t));
        } catch {
          return t.toXDR("base64");
        }
      }),
      value: event.value
        ? (() => {
            try {
              return scValToNative(event.value);
            } catch {
              return null;
            }
          })()
        : null,
    }));
  } catch (err) {
    logger.error("[soroban] getContractEvents failed", { error: String(err) });
    return [];
  }
}

// ─── Legacy compatibility exports ─────────────────────────────────────────────

/**
 * @deprecated Use executeSorobanDisbursementBatch + finalizeDisbursement instead.
 * Kept for backward compatibility with existing disbursement.service.ts calls.
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

    const { hash, success } = await simulateSignSubmit(server, tx, keypair);
    return { success, txHash: hash };
  } catch (err) {
    logger.error("[soroban] executeSorobanDisbursement (legacy) failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}
