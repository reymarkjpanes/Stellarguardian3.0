/**
 * Concrete `AppError` subclasses covering every canonical error status in
 * the API contract (Req 18.3): 400, 401, 403, 404, 409, 422, 429, 503.
 *
 * Each class has a fixed `code` and `httpStatus` and a sensible default
 * `message`, while callers can override the message and/or attach `details`
 * per-instance (e.g. `new NotFoundError("Event not found")` or
 * `new ValidationError("Invalid input", { fieldErrors })`).
 *
 * Domain-specific errors added by later tasks (state machine, escrow,
 * wallet verification, etc.) extend `AppError` directly - see design.md's
 * "Unified Error Model" for the full representative list
 * (`InvalidTransitionError`, `ConflictOfInterestError`,
 * `EscrowInconsistentError`, `WalletUnverifiedError`, ...). Only the
 * general-purpose, status-code-generic errors live here.
 */
import { AppError } from "./app-error";

/** 400 - malformed or semantically invalid request that isn't a Zod failure. */
export class BadRequestError extends AppError {
  readonly code = "BAD_REQUEST";
  readonly httpStatus = 400;

  constructor(message = "The request could not be understood.", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** 401 - request lacks valid authentication credentials (Req 3.5). */
export class UnauthenticatedError extends AppError {
  readonly code = "UNAUTHENTICATED";
  readonly httpStatus = 401;

  constructor(
    message = "Authentication is required to access this resource.",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/** 403 - authenticated but not permitted to perform the action (Req 3.6, 39.10). */
export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
  readonly httpStatus = 403;

  constructor(
    message = "You do not have permission to perform this action.",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/** 404 - the requested resource does not exist. */
export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;

  constructor(
    message = "The requested resource was not found.",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/** 409 - the request conflicts with the current state of the resource (Req 13.4, 19.3). */
export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;

  constructor(
    message = "The resource has been modified since it was last read.",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/**
 * 422 - the request was well-formed but failed semantic/schema validation
 * (Req 18.5). `details` should carry the flattened Zod field errors.
 */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_FAILED";
  readonly httpStatus = 422;

  constructor(message = "The request failed validation.", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** 429 - the caller has exceeded the allowed request rate (Req 14.2). */
export class RateLimitError extends AppError {
  readonly code = "RATE_LIMITED";
  readonly httpStatus = 429;

  constructor(
    message = "Too many requests. Please try again later.",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/** 503 - a required upstream dependency (e.g. the database) is unavailable (Req 2.6). */
export class ServiceUnavailableError extends AppError {
  readonly code = "SERVICE_UNAVAILABLE";
  readonly httpStatus = 503;

  constructor(
    message = "The service is temporarily unavailable. Please try again shortly.",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/** 422 - A business rule was violated during domain logic execution. */
export class BusinessRuleError extends AppError {
  readonly code = "BUSINESS_RULE_VIOLATION";
  readonly httpStatus = 422;

  constructor(
    message = "A business rule was violated.",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}
