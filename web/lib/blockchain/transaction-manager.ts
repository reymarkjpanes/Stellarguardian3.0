/**
 * Client-side Transaction Lifecycle Manager.
 *
 * Every blockchain action goes through this centralized manager.
 * Provides a uniform state machine for the transaction lifecycle:
 *
 *   idle → preparing → simulating → awaiting_signature → submitting
 *       → pending_confirmation → confirmed | failed
 *
 * Consumer:
 *   const { state, execute, reset } = useTransactionManager();
 *   await execute(async (updateState) => {
 *     updateState("preparing");
 *     const xdr = await buildDepositTx(amount);
 *     updateState("awaiting_signature");
 *     const signed = await wallet.signTransaction(xdr, network);
 *     updateState("submitting");
 *     const result = await submitSignedTx(signed);
 *     return result;
 *   });
 */

export type TransactionStatus =
  | "idle"
  | "preparing"
  | "simulating"
  | "awaiting_signature"
  | "submitting"
  | "pending_confirmation"
  | "confirmed"
  | "failed";

export interface TransactionState {
  status: TransactionStatus;
  txHash: string | null;
  explorerUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Whether the failed operation is retryable */
  retryable: boolean;
  /** Recovery suggestion for the user */
  recoveryAction: string | null;
}

export const INITIAL_TRANSACTION_STATE: TransactionState = {
  status: "idle",
  txHash: null,
  explorerUrl: null,
  errorCode: null,
  errorMessage: null,
  retryable: false,
  recoveryAction: null,
};

/** Human-readable labels for transaction status display */
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  idle: "Ready",
  preparing: "Preparing transaction…",
  simulating: "Simulating on network…",
  awaiting_signature: "Waiting for wallet approval…",
  submitting: "Submitting to network…",
  pending_confirmation: "Waiting for confirmation…",
  confirmed: "Confirmed",
  failed: "Failed",
};

export type TransactionStatusUpdater = (
  status: TransactionStatus,
  meta?: { txHash?: string; explorerUrl?: string },
) => void;

export type TransactionExecutor<T> = (updateStatus: TransactionStatusUpdater) => Promise<{
  txHash?: string;
  explorerUrl?: string;
  result?: T;
}>;
