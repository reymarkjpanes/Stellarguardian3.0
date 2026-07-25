"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Lock } from "lucide-react";

interface FinalizationActionBoxProps {
  onFinalize: () => Promise<void>;
  disabled: boolean;
  warningMessage?: string;
}

// ---------------------------------------------------------------------------
// Standalone modal — avoids the non-functional stub in /components/ui/dialog
// ---------------------------------------------------------------------------

interface FinalizeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function FinalizeModal({ open, onClose, onConfirm }: FinalizeModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstFocusable = useRef<HTMLButtonElement>(null);

  const isMatch = confirmText === "FINALIZE";

  // Focus the input whenever the modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape key closes (unless submitting)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    },
    [isSubmitting, onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleConfirm = async () => {
    if (!isMatch || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  if (!open) return null;

  const modal = (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
    >
      <div
        key={open ? "open" : "closed"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalize-modal-title"
        aria-describedby="finalize-modal-desc"
        className="relative w-full max-w-md rounded-xl border shadow-2xl"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "color-mix(in srgb, var(--error) 40%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top danger strip */}
        <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: "var(--error)" }} />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--error-bg)" }}
              >
                <Lock className="h-4 w-4" style={{ color: "var(--error)" }} aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="finalize-modal-title"
                  className="text-base font-semibold leading-snug"
                  style={{ color: "var(--text)" }}
                >
                  Are you absolutely sure?
                </h2>
                <p
                  id="finalize-modal-desc"
                  className="mt-1 text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  This will <strong style={{ color: "var(--text)" }}>lock all evaluations</strong>{" "}
                  and freeze the rankings{" "}
                  <strong style={{ color: "var(--text)" }}>permanently</strong>. Draft and Flagged
                  evaluations will be ignored. This action cannot be undone.
                </p>
              </div>
            </div>

            <button
              ref={firstFocusable}
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close"
              className="shrink-0 rounded-md p-1 transition-colors disabled:pointer-events-none"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
              }
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <label
              htmlFor="finalize-confirm-input"
              className="block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Type{" "}
              <code
                className="rounded px-1.5 py-0.5 text-xs font-mono font-semibold"
                style={{
                  backgroundColor: "var(--error-bg)",
                  color: "var(--error)",
                }}
              >
                FINALIZE
              </code>{" "}
              to confirm:
            </label>
            <input
              id="finalize-confirm-input"
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              placeholder="FINALIZE"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={isSubmitting}
              className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono transition-colors placeholder:font-sans disabled:opacity-50"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: isMatch ? "var(--error)" : "var(--input-border)",
                color: "var(--text)",
                outline: "none",
                boxShadow: isMatch ? "0 0 0 1px var(--error)" : undefined,
              }}
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")
              }
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isMatch || isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-40"
              style={{
                backgroundColor: isMatch && !isSubmitting ? "var(--error)" : "var(--error-bg)",
                color: isMatch && !isSubmitting ? "#fff" : "var(--error)",
              }}
              onMouseEnter={(e) => {
                if (isMatch && !isSubmitting)
                  (e.currentTarget as HTMLElement).style.opacity = "0.88";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
              }}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Finalizing…
                </>
              ) : (
                "Confirm Finalization"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render into document.body via portal so it escapes any overflow:hidden parents
  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

// ---------------------------------------------------------------------------
// Public component — the danger card + trigger
// ---------------------------------------------------------------------------

export function FinalizationActionBox({
  onFinalize,
  disabled,
  warningMessage,
}: FinalizationActionBoxProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="card p-6"
        style={{
          borderColor: "color-mix(in srgb, var(--error) 30%, var(--border))",
          backgroundColor: "color-mix(in srgb, var(--error-bg) 40%, var(--card-bg))",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold" style={{ color: "var(--error)" }}>
              Finalize Judging &amp; Generate Rankings
            </h3>
            <p className="text-sm max-w-xl" style={{ color: "var(--text-secondary)" }}>
              Permanently locks all submitted evaluations, generates final ranking snapshots, and
              closes the Judging phase. This action cannot be undone.
            </p>
            {warningMessage && (
              <div
                className="flex items-center gap-2 pt-1 text-sm font-medium"
                style={{ color: "var(--warning)" }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {warningMessage}
              </div>
            )}
          </div>

          <button
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-40"
            style={{
              backgroundColor: "var(--error)",
              color: "#fff",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.88")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Finalize Event
          </button>
        </div>
      </div>

      <FinalizeModal open={open} onClose={() => setOpen(false)} onConfirm={onFinalize} />
    </>
  );
}
