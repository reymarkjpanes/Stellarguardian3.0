export type ErrorCode =
  // Auth
  | "AUTH_UNAUTHORIZED"
  | "AUTH_FORBIDDEN"
  | "AUTH_SESSION_EXPIRED"
  // Validation
  | "VALIDATION_FAILED"
  | "VALIDATION_SCHEMA"
  | "VALIDATION_INVALID_CURSOR"
  // Resource
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_ARCHIVED"
  | "RESOURCE_DELETED"
  // Team
  | "TEAM_NOT_FOUND"
  | "TEAM_LOCKED"
  | "TEAM_FULL"
  | "TEAM_ALREADY_EXISTS"
  | "TEAM_ALREADY_ARCHIVED"
  | "TEAM_INVALID_STATE"
  | "TEAM_CAPTAIN_REQUIRED"
  | "TEAM_CAPTAIN_TRANSFER_REQUIRED"
  | "TEAM_MEMBER_ALREADY_EXISTS"
  | "TEAM_MEMBER_NOT_FOUND"
  | "TEAM_JOIN_REQUEST_EXISTS"
  | "TEAM_INVITATION_EXISTS"
  // Event
  | "EVENT_NOT_ACTIVE"
  | "EVENT_REGISTRATION_CLOSED"
  | "EVENT_TEAM_FORMATION_LOCKED"
  // State
  | "STATE_TRANSITION_INVALID"
  | "STATE_CONFLICT"
  // General
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL";

export class DomainError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly metadata?: Record<string, unknown>;

  constructor(message: string, code: ErrorCode, status: number = 400, metadata?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.metadata = metadata;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "VALIDATION_FAILED", 400, metadata);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, metadata);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "RESOURCE_NOT_FOUND", 404, metadata);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "AUTH_UNAUTHORIZED", 401, metadata);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "AUTH_FORBIDDEN", 403, metadata);
  }
}

export class BusinessRuleViolation extends DomainError {
  constructor(message: string, code: ErrorCode, metadata?: Record<string, unknown>) {
    super(message, code, 422, metadata);
  }
}

export class StateTransitionError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "STATE_TRANSITION_INVALID", 422, metadata);
  }
}

export class CapacityExceededError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "TEAM_FULL", 409, metadata);
  }
}

export class DuplicateRequestError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, metadata);
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "RATE_LIMITED", 429, metadata);
  }
}

export class InfrastructureError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "INTERNAL", 500, metadata);
  }
}
