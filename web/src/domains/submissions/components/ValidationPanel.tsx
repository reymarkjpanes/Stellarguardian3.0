import React from "react";

interface ValidationPanelProps {
  validationResult:
    | {
        isReady: boolean;
        progress: number;
        missing: string[];
        passed: string[];
        warnings: string[];
        errors: string[];
      }
    | null
    | undefined;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** Only the team captain can submit. Members can fill in requirements. */
  isCaptain: boolean;
}

export function ValidationPanel({
  validationResult,
  onSubmit,
  isSubmitting,
  isCaptain,
}: ValidationPanelProps) {
  if (!validationResult) {
    return (
      <div className="card p-6 space-y-4 animate-pulse">
        <div className="h-4 rounded bg-[var(--bg-muted)] w-1/2" />
        <div className="h-10 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 rounded bg-[var(--bg-muted)] w-full" />
        <div className="h-4 rounded bg-[var(--bg-muted)] w-3/4" />
      </div>
    );
  }

  const { isReady, progress, missing, passed, warnings, errors } = validationResult;
  const canSubmit = isReady && isCaptain;

  return (
    <div className="card flex flex-col overflow-hidden sticky top-24 max-h-[calc(100vh-120px)]">
      {/* Progress header */}
      <div className="p-5 border-b border-[var(--border)]">
        <p className="text-sm font-semibold text-[var(--text)] mb-2">Submission Readiness</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl font-bold text-[var(--text)]">{progress}%</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isReady
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--warning-bg)] text-[var(--warning)]"
            }`}
          >
            {isReady ? "Ready to submit" : "Incomplete"}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: isReady ? "var(--success)" : "var(--accent)",
            }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[var(--bg-elevated)]">
        {/* Blocking issues */}
        {(errors.length > 0 || missing.length > 0) && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Blocking Issues
            </p>
            <ul className="space-y-1.5">
              {errors.map((e, i) => (
                <li key={`e-${i}`} className="flex items-start gap-2 text-xs text-[var(--error)]">
                  <span className="shrink-0 mt-0.5">✕</span>
                  <span>{e}</span>
                </li>
              ))}
              {missing.map((m, i) => (
                <li key={`m-${i}`} className="flex items-start gap-2 text-xs text-[var(--warning)]">
                  <span className="shrink-0 mt-0.5">!</span>
                  <span>Missing: {m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Completed sections */}
        {passed.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Completed
            </p>
            <ul className="space-y-1.5">
              {passed.map((p, i) => (
                <li
                  key={`p-${i}`}
                  className="flex items-center gap-2 text-xs text-[var(--success)]"
                >
                  <span>✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Recommendations
            </p>
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li
                  key={`w-${i}`}
                  className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"
                >
                  <span className="shrink-0 mt-0.5">·</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Submit footer */}
      <div className="p-5 border-t border-[var(--border)] bg-[var(--card-bg)] space-y-2">
        <button
          disabled={!canSubmit || isSubmitting}
          onClick={onSubmit}
          className="w-full rounded-md py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: canSubmit ? "var(--accent)" : "var(--bg-muted)",
            color: canSubmit ? "#ffffff" : "var(--text-muted)",
          }}
        >
          {isSubmitting ? "Submitting…" : "Submit Project"}
        </button>

        {/* Context-aware helper text */}
        {!isCaptain && (
          <p className="text-xs text-center text-[var(--text-muted)]">
            Only the team captain can submit. Fill in your sections and ask your captain to
            finalize.
          </p>
        )}
        {isCaptain && !isReady && (
          <p className="text-xs text-center text-[var(--text-muted)]">
            Complete all required sections above to unlock submission.
          </p>
        )}
        {isCaptain && isReady && (
          <p className="text-xs text-center text-[var(--success)]">
            All requirements met. Ready to submit.
          </p>
        )}
      </div>
    </div>
  );
}
