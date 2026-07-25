/**
 * Blockchain error taxonomy (Production requirement: comprehensive error handling).
 *
 * Every blockchain error provides:
 * - code:            machine-readable identifier
 * - userMessage:     shown in UI (no jargon, actionable)
 * - devMessage:      full technical detail for logs/console
 * - recoveryAction:  what the user can do next (optional)
 * - retryable:       whether the operation can be retried
 */

export type BlockchainErrorCode =
  // Wallet errors
  | "WALLET_NOT_INSTALLED"
  | "WALLET_CONNECTION_REJECTED"
  | "WALLET_SIGNATURE_REJECTED"
  | "WALLET_NETWORK_MISMATCH"
  | "WALLET_LOCKED"
  | "WALLET_UNKNOWN"
  // Network errors
  | "NETWORK_UNAVAILABLE"
  | "RPC_FAILURE"
  | "HORIZON_FAILURE"
  | "TRANSACTION_TIMEOUT"
  // Simulation errors
  | "SIMULATION_FAILED"
  | "INSUFFICIENT_BALANCE"
  | "INVALID_CONTRACT_PARAMETERS"
  // Contract errors
  | "CONTRACT_EXECUTION_FAILED"
  | "CONTRACT_NOT_INITIALIZED"
  | "CONTRACT_ALREADY_INITIALIZED"
  | "CONTRACT_INVALID_STATE"
  | "CONTRACT_UNAUTHORIZED"
  // Submission errors
  | "TRANSACTION_REJECTED"
  | "TRANSACTION_FAILED"
  | "DUPLICATE_TRANSACTION"
  // Generic fallback
  | "UNKNOWN";

export interface BlockchainError {
  code: BlockchainErrorCode;
  userMessage: string;
  devMessage: string;
  recoveryAction?: string;
  retryable: boolean;
  originalError?: unknown;
}

/** Create a typed blockchain error */
export function createBlockchainError(
  code: BlockchainErrorCode,
  devMessage: string,
  originalError?: unknown,
): BlockchainError {
  const template = ERROR_TEMPLATES[code];
  return {
    code,
    userMessage: template.userMessage,
    devMessage,
    recoveryAction: template.recoveryAction,
    retryable: template.retryable,
    originalError,
  };
}

const ERROR_TEMPLATES: Record<
  BlockchainErrorCode,
  { userMessage: string; recoveryAction?: string; retryable: boolean }
> = {
  WALLET_NOT_INSTALLED: {
    userMessage: "Wallet extension not found.",
    recoveryAction: "Install the wallet extension and refresh the page.",
    retryable: false,
  },
  WALLET_CONNECTION_REJECTED: {
    userMessage: "Wallet connection was declined.",
    recoveryAction: "Click Connect again and approve the request in your wallet.",
    retryable: true,
  },
  WALLET_SIGNATURE_REJECTED: {
    userMessage: "You declined to sign the transaction.",
    recoveryAction: "Click the action again and approve the signing request in your wallet.",
    retryable: true,
  },
  WALLET_NETWORK_MISMATCH: {
    userMessage: "Your wallet is on the wrong network.",
    recoveryAction: "Switch your wallet to Testnet and try again.",
    retryable: true,
  },
  WALLET_LOCKED: {
    userMessage: "Your wallet appears to be locked.",
    recoveryAction: "Unlock your wallet extension and try again.",
    retryable: true,
  },
  WALLET_UNKNOWN: {
    userMessage: "Wallet error.",
    recoveryAction: "Make sure your wallet extension is unlocked and try again.",
    retryable: true,
  },
  NETWORK_UNAVAILABLE: {
    userMessage: "Unable to reach the Stellar network.",
    recoveryAction: "Check your internet connection and try again.",
    retryable: true,
  },
  RPC_FAILURE: {
    userMessage: "Soroban RPC request failed.",
    recoveryAction: "The network may be congested. Try again in a moment.",
    retryable: true,
  },
  HORIZON_FAILURE: {
    userMessage: "Stellar Horizon server error.",
    recoveryAction: "Try again in a moment.",
    retryable: true,
  },
  TRANSACTION_TIMEOUT: {
    userMessage: "Transaction took too long to confirm.",
    recoveryAction: "Check the explorer to see if the transaction landed. If not, try again.",
    retryable: true,
  },
  SIMULATION_FAILED: {
    userMessage: "Transaction simulation failed.",
    recoveryAction: "Your transaction parameters may be invalid. Contact support if this persists.",
    retryable: false,
  },
  INSUFFICIENT_BALANCE: {
    userMessage: "Insufficient balance for this transaction.",
    recoveryAction: "Add more XLM to your wallet and try again.",
    retryable: false,
  },
  INVALID_CONTRACT_PARAMETERS: {
    userMessage: "Invalid transaction parameters.",
    recoveryAction: "Refresh the page and try again. Contact support if this persists.",
    retryable: false,
  },
  CONTRACT_EXECUTION_FAILED: {
    userMessage: "The escrow contract rejected this operation.",
    recoveryAction: "The escrow may be in an unexpected state. Contact support.",
    retryable: false,
  },
  CONTRACT_NOT_INITIALIZED: {
    userMessage: "Escrow contract has not been initialized yet.",
    recoveryAction: "The event organizer needs to initialize the escrow first.",
    retryable: false,
  },
  CONTRACT_ALREADY_INITIALIZED: {
    userMessage: "Escrow contract is already initialized.",
    retryable: false,
  },
  CONTRACT_INVALID_STATE: {
    userMessage: "This action is not allowed in the current escrow state.",
    recoveryAction: "The escrow lifecycle does not permit this operation right now.",
    retryable: false,
  },
  CONTRACT_UNAUTHORIZED: {
    userMessage: "You are not authorized to perform this contract operation.",
    retryable: false,
  },
  TRANSACTION_REJECTED: {
    userMessage: "Transaction was rejected by the network.",
    recoveryAction: "Check that your wallet has sufficient balance for fees.",
    retryable: false,
  },
  TRANSACTION_FAILED: {
    userMessage: "Transaction failed on-chain.",
    recoveryAction: "Review the transaction details. Contact support if this persists.",
    retryable: false,
  },
  DUPLICATE_TRANSACTION: {
    userMessage: "This transaction has already been submitted.",
    recoveryAction: "Refresh the page — your previous submission may have succeeded.",
    retryable: false,
  },
  UNKNOWN: {
    userMessage: "An unexpected error occurred.",
    recoveryAction: "Refresh the page and try again. Contact support if this persists.",
    retryable: true,
  },
};

/**
 * Parse an unknown error into a typed BlockchainError.
 * Inspects error messages/codes to classify correctly.
 */
export function parseBlockchainError(err: unknown): BlockchainError {
  const message = err instanceof Error ? err.message : String(err);
  const lowerMessage = message.toLowerCase();

  // Wallet not installed
  if (
    lowerMessage.includes("not installed") ||
    lowerMessage.includes("extension not found") ||
    lowerMessage.includes("is not installed") ||
    lowerMessage.includes("xbull is not") ||
    lowerMessage.includes("lobstr is not") ||
    lowerMessage.includes("rabet is not") ||
    lowerMessage.includes("albedo library is not installed")
  ) {
    return createBlockchainError("WALLET_NOT_INSTALLED", message, err);
  }

  // User rejected connection
  if (
    lowerMessage.includes("user rejected") ||
    lowerMessage.includes("connection rejected") ||
    lowerMessage.includes("access denied") ||
    lowerMessage.includes("not allowed")
  ) {
    return createBlockchainError("WALLET_CONNECTION_REJECTED", message, err);
  }

  // User rejected signing
  if (
    lowerMessage.includes("declined") ||
    lowerMessage.includes("rejected signing") ||
    lowerMessage.includes("signature request") ||
    lowerMessage.includes("sign.*reject") ||
    lowerMessage.includes("user rejected transaction")
  ) {
    return createBlockchainError("WALLET_SIGNATURE_REJECTED", message, err);
  }

  // Network mismatch
  if (lowerMessage.includes("network mismatch") || lowerMessage.includes("wrong network")) {
    return createBlockchainError("WALLET_NETWORK_MISMATCH", message, err);
  }

  // Wallet locked
  if (lowerMessage.includes("locked") && lowerMessage.includes("wallet")) {
    return createBlockchainError("WALLET_LOCKED", message, err);
  }

  // Insufficient balance
  if (
    lowerMessage.includes("insufficient") ||
    lowerMessage.includes("underfunded") ||
    lowerMessage.includes("op_underfunded")
  ) {
    return createBlockchainError("INSUFFICIENT_BALANCE", message, err);
  }

  // Simulation failed
  if (lowerMessage.includes("simulation failed")) {
    // Check for specific contract errors in simulation output
    if (lowerMessage.includes("already initialized")) {
      return createBlockchainError("CONTRACT_ALREADY_INITIALIZED", message, err);
    }
    if (lowerMessage.includes("must be fully funded")) {
      return createBlockchainError("CONTRACT_INVALID_STATE", message, err);
    }
    if (lowerMessage.includes("must be locked")) {
      return createBlockchainError("CONTRACT_INVALID_STATE", message, err);
    }
    if (lowerMessage.includes("only organizer") || lowerMessage.includes("unauthorized")) {
      return createBlockchainError("CONTRACT_UNAUTHORIZED", message, err);
    }
    return createBlockchainError("SIMULATION_FAILED", message, err);
  }

  // Transaction timeout
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return createBlockchainError("TRANSACTION_TIMEOUT", message, err);
  }

  // RPC errors
  if (lowerMessage.includes("rpc") || lowerMessage.includes("soroban")) {
    return createBlockchainError("RPC_FAILURE", message, err);
  }

  // Horizon/network errors
  if (
    lowerMessage.includes("horizon") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch failed") ||
    lowerMessage.includes("econnrefused")
  ) {
    return createBlockchainError("NETWORK_UNAVAILABLE", message, err);
  }

  // Duplicate tx
  if (lowerMessage.includes("tx_duplicate_operation") || lowerMessage.includes("duplicate")) {
    return createBlockchainError("DUPLICATE_TRANSACTION", message, err);
  }

  // Contract execution failed (result_codes from Horizon)
  if (
    lowerMessage.includes("result_codes") ||
    lowerMessage.includes("op_no_destination") ||
    lowerMessage.includes("tx_failed")
  ) {
    return createBlockchainError("TRANSACTION_FAILED", message, err);
  }

  return createBlockchainError("UNKNOWN", message, err);
}
