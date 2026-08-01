"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import type { EventState } from "@/types";

export interface ConfirmTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  targetState?: EventState | string;
  targetStateName?: string;
  riskWarning?: string;
  actionLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export function ConfirmTransitionModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm State Transition",
  targetState,
  targetStateName,
  riskWarning,
  actionLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
}: ConfirmTransitionModalProps) {
  const stateDisplayName = targetStateName || (targetState ? String(targetState) : "");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {stateDisplayName && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Target State:
            </span>
            <span className="rounded-md bg-[var(--accent-muted,#e0e7ff)] px-2.5 py-1 text-xs font-semibold text-[var(--accent,#4f46e5)]">
              {stateDisplayName}
            </span>
          </div>
        )}

        {riskWarning ? (
          <div className="rounded-md border border-[var(--warning,#f59e0b)]/30 bg-[var(--warning-bg,#fffbeb)] p-3 text-xs text-[var(--warning,#b45309)]">
            <div className="flex items-start gap-2">
              <svg
                className="h-4 w-4 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="leading-relaxed font-medium">{riskWarning}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Are you sure you want to proceed with this state transition?
          </p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md border border-transparent bg-[var(--accent,#4f46e5)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover,#4338ca)] transition-colors disabled:opacity-50"
          >
            {loading ? "Processing..." : actionLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
