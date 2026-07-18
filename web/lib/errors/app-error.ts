/**
 * Unified typed error hierarchy (Req 18.1-18.4, 20.5).
 *
 * All domain and route-handler code throws `AppError` subclasses instead of
 * plain `Error`s or ad-hoc `NextResponse.json(...)` calls. The global handler
 * in `./handler.ts` is the *only* place that converts a thrown error into an
 * HTTP response, guaranteeing every error reaches the client through the
 * canonical envelope `{ error: { code, message, details? } }` with the
 * correct, semantically meaningful status code (Req 18.2, 18.3).
 *
 * Each subclass carries:
 *   - `code`: a stable, machine-readable identifier frontend code can switch
 *     on (never changes across releases, unlike `message`).
 *   - `httpStatus`: the canonical HTTP status for that error class.
 *   - `details`: optional structured, field-level context (e.g. Zod flattened
 *     field errors for validation failures, Req 18.5). Never contains stack
 *     traces or other internals.
 *
 * Domain-specific errors introduced by later tasks (e.g. state-machine
 * `InvalidTransitionError`, escrow `EscrowInconsistentError`) should extend
 * `AppError` from this module rather than defining a parallel hierarchy.
 */

export abstract class AppError extends Error {
  /** Stable, machine-readable error code (Req 18.2). */
  abstract readonly code: string;

  /** Canonical HTTP status for this error class (Req 18.3). */
  abstract readonly httpStatus: number;

  /** Optional field-level/structured context surfaced to the client. */
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    // Restore correct prototype chain when compiled targets predate native
    // `Error` subclassing support (defensive; also fixes `instanceof` checks
    // under some transpilation configurations).
    Object.setPrototypeOf(this, this.constructor.prototype);
  }
}
