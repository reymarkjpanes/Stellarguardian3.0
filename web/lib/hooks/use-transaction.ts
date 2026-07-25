"use client";

/**
 * useTransaction — centralized transaction lifecycle hook.
 *
 * Wraps any blockchain action in a uniform state machine.
 * Components get live status updates without managing state themselves.
 *
 * Usage:
 *   const { state, execute, reset } = useTransaction();
 *
 *   const handleFund = () => execute(async (update) => {
 *     update("preparing");
 *     const { xdr } = await fetch("/api/escrow/build-deposit", ...).then(r => r.json());
 *
 *     update("awaiting_signature");
 *     const signed = await wallet.adapter.signTransaction(xdr, "testnet");
 *
 *     update("submitting");
 *     const { hash } = await fetch("/api/stellar/submit", {
 *       method: "POST",
 *       body: JSON.stringify({ signed_xdr: signed }),
 *     }).then(r => r.json());
 *
 *     update("pending_confirmation", { txHash: hash });
 *     return { txHash: hash, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}` };
 *   });
 */
import { useState, useCallback } from "react";
import {
  type TransactionState,
  type TransactionExecutor,
  type TransactionStatus,
  type TransactionStatusUpdater,
  INITIAL_TRANSACTION_STATE,
} from "@/lib/blockchain/transaction-manager";
import { parseBlockchainError } from "@/lib/blockchain/errors";

export interface UseTransactionReturn<T = unknown> {
  state: TransactionState;
  execute: (executor: TransactionExecutor<T>) => Promise<T | null>;
  reset: () => void;
  isActive: boolean;
}

export function useTransaction<T = unknown>(): UseTransactionReturn<T> {
  const [state, setState] = useState<TransactionState>(INITIAL_TRANSACTION_STATE);

  const updateStatus: TransactionStatusUpdater = useCallback(
    (status: TransactionStatus, meta?: { txHash?: string; explorerUrl?: string }) => {
      setState((prev) => ({
        ...prev,
        status,
        txHash: meta?.txHash ?? prev.txHash,
        explorerUrl: meta?.explorerUrl ?? prev.explorerUrl,
        // Clear error when transitioning to a new non-failed state
        errorCode: status !== "failed" ? null : prev.errorCode,
        errorMessage: status !== "failed" ? null : prev.errorMessage,
      }));
    },
    [],
  );

  const execute = useCallback(
    async (executor: TransactionExecutor<T>): Promise<T | null> => {
      setState(INITIAL_TRANSACTION_STATE);
      try {
        const outcome = await executor(updateStatus);
        setState((prev) => ({
          ...prev,
          status: "confirmed",
          txHash: outcome.txHash ?? prev.txHash,
          explorerUrl: outcome.explorerUrl ?? prev.explorerUrl,
          errorCode: null,
          errorMessage: null,
        }));
        return (outcome.result ?? null) as T | null;
      } catch (err) {
        const parsed = parseBlockchainError(err);
        setState((prev) => ({
          ...prev,
          status: "failed",
          errorCode: parsed.code,
          errorMessage: parsed.userMessage,
          retryable: parsed.retryable,
          recoveryAction: parsed.recoveryAction ?? null,
        }));
        // Log the developer message to console (not surfaced to user)
        console.error("[useTransaction] blockchain error", {
          code: parsed.code,
          devMessage: parsed.devMessage,
          originalError: parsed.originalError,
        });
        return null;
      }
    },
    [updateStatus],
  );

  const reset = useCallback(() => {
    setState(INITIAL_TRANSACTION_STATE);
  }, []);

  const isActive =
    state.status !== "idle" && state.status !== "confirmed" && state.status !== "failed";

  return { state, execute, reset, isActive };
}
