/**
 * Permission Matrix and Authorization (Req 27, 3.3, 3.6, 3.7, 12.6).
 *
 * Declarative `PlatformRole × ResourceCategory × Action` matrix with a single
 * `authorize()` helper replacing 15+ inline organizer checks. Denial emits an
 * audit permission-denied record (Req 27.11).
 *
 * The permission matrix is enforced at BOTH API middleware (this module) and
 * database RLS (task 3.3) for defense-in-depth (Req 27.10).
 */
import "server-only";

import type { Action, PlatformRole, ResourceCategory } from "@/types";
import { ForbiddenError } from "@/lib/errors";

/**
 * Scope for permission checks — workspace and event context for
 * resource-level authorization.
 */
export interface PermissionScope {
  /** The workspace the resource belongs to (null for platform-level checks). */
  workspaceId?: string;
  /** The event the resource belongs to (null for workspace-level checks). */
  eventId?: string;
  /** The user performing the action. */
  userId: string;
}

/**
 * Auth context injected by the request pipeline (task 6.1).
 */
export interface AuthContext {
  userId: string;
  role: PlatformRole;
  scope: PermissionScope;
}

/**
 * The permission matrix — PlatformRole × ResourceCategory × Action.
 *
 * `true` means the role can perform the action on the resource.
 * Omitted entries default to `false` (deny-by-default, Req 27.1).
 *
 * This is intentionally verbose for auditability. Each entry corresponds to
 * a documented permission rule in Req 27.3-27.9.
 */
type PermissionMatrix = Record<PlatformRole, Partial<Record<ResourceCategory, Set<Action>>>>;

const MATRIX: PermissionMatrix = {
  PlatformAdmin: {
    Events: new Set(["read", "create", "update", "delete", "approve", "reject"]),
    Submissions: new Set(["read", "update", "delete"]),
    Evaluations: new Set(["read", "update", "delete"]),
    Teams: new Set(["read", "update", "delete"]),
    EscrowFunding: new Set(["read", "create", "update"]),
    Disbursements: new Set(["read", "create", "approve"]),
    Workspaces: new Set(["read", "create", "update", "delete"]),
    Members: new Set(["read", "create", "update", "delete"]),
    Invitations: new Set(["read", "create", "delete"]),
    Sponsors: new Set(["read", "create", "update", "delete"]),
    Milestones: new Set(["read", "create", "update", "delete"]),
    Disputes: new Set(["read", "create", "update", "approve", "reject"]),
    Notifications: new Set(["read", "update", "delete"]),
  },
  WorkspaceOwner: {
    Events: new Set(["read", "create", "update", "delete"]),
    Submissions: new Set(["read"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read", "update", "delete"]),
    EscrowFunding: new Set(["read", "create"]),
    Disbursements: new Set(["read", "create"]),
    Workspaces: new Set(["read", "update", "delete"]),
    Members: new Set(["read", "create", "update", "delete"]),
    Invitations: new Set(["read", "create", "delete"]),
    Sponsors: new Set(["read", "create", "update", "delete"]),
    Milestones: new Set(["read", "create", "update", "delete"]),
    Disputes: new Set(["read", "update", "approve", "reject"]),
    Notifications: new Set(["read", "update"]),
  },
  WorkspaceAdmin: {
    Events: new Set(["read", "create", "update"]),
    Submissions: new Set(["read"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read", "update"]),
    EscrowFunding: new Set(["read"]),
    Disbursements: new Set(["read"]),
    Workspaces: new Set(["read", "update"]),
    Members: new Set(["read", "create", "update", "delete"]),
    Invitations: new Set(["read", "create", "delete"]),
    Sponsors: new Set(["read", "create", "update", "delete"]),
    Milestones: new Set(["read", "create", "update", "delete"]),
    Disputes: new Set(["read", "update", "approve", "reject"]),
    Notifications: new Set(["read", "update"]),
  },
  Organizer: {
    Events: new Set(["read", "create", "update", "delete"]),
    Submissions: new Set(["read"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read", "update"]),
    EscrowFunding: new Set(["read", "create"]),
    Disbursements: new Set(["read", "create"]),
    Workspaces: new Set(["read"]),
    Members: new Set(["read", "create", "update", "delete"]),
    Invitations: new Set(["read", "create", "delete"]),
    Sponsors: new Set(["read", "create", "update", "delete"]),
    Milestones: new Set(["read", "create", "update", "delete"]),
    Disputes: new Set(["read", "update", "approve", "reject"]),
    Notifications: new Set(["read", "update"]),
  },
  Sponsor: {
    Events: new Set(["read"]),
    Submissions: new Set(["read"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read"]),
    EscrowFunding: new Set(["read"]),
    Disbursements: new Set(["read"]),
    Workspaces: new Set(["read"]),
    Members: new Set(["read"]),
    Invitations: new Set(["read"]),
    Sponsors: new Set(["read"]),
    Milestones: new Set(["read"]),
    Disputes: new Set(["read"]),
    Notifications: new Set(["read", "update"]),
  },
  Judge: {
    Events: new Set(["read"]),
    Submissions: new Set(["read"]),
    Evaluations: new Set(["read", "create", "update"]),
    Teams: new Set(["read"]),
    EscrowFunding: new Set(["read"]),
    Disbursements: new Set(["read"]),
    Workspaces: new Set(["read"]),
    Members: new Set(["read"]),
    Invitations: new Set(["read"]),
    Sponsors: new Set(["read"]),
    Milestones: new Set(["read"]),
    Disputes: new Set(["read"]),
    Notifications: new Set(["read", "update"]),
  },
  Mentor: {
    Events: new Set(["read"]),
    Submissions: new Set(["read"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read"]),
    EscrowFunding: new Set(["read"]),
    Disbursements: new Set(["read"]),
    Workspaces: new Set(["read"]),
    Members: new Set(["read"]),
    Invitations: new Set(["read"]),
    Sponsors: new Set(["read"]),
    Milestones: new Set(["read"]),
    Disputes: new Set(["read"]),
    Notifications: new Set(["read", "update"]),
  },
  Participant: {
    Events: new Set(["read"]),
    Submissions: new Set(["read", "create", "update"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read", "create", "update"]),
    EscrowFunding: new Set(["read"]),
    Disbursements: new Set(["read"]),
    Workspaces: new Set(["read"]),
    Members: new Set(["read"]),
    Invitations: new Set(["read"]),
    Sponsors: new Set(["read"]),
    Milestones: new Set(["read"]),
    Disputes: new Set(["read", "create"]),
    Notifications: new Set(["read", "update"]),
  },
  TeamCaptain: {
    Events: new Set(["read"]),
    Submissions: new Set(["read", "create", "update"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read", "create", "update", "delete"]),
    EscrowFunding: new Set(["read"]),
    Disbursements: new Set(["read"]),
    Workspaces: new Set(["read"]),
    Members: new Set(["read", "create", "delete"]),
    Invitations: new Set(["read", "create", "delete"]),
    Sponsors: new Set(["read"]),
    Milestones: new Set(["read"]),
    Disputes: new Set(["read", "create"]),
    Notifications: new Set(["read", "update"]),
  },
  TeamMember: {
    Events: new Set(["read"]),
    Submissions: new Set(["read", "create", "update"]),
    Evaluations: new Set(["read"]),
    Teams: new Set(["read"]),
    EscrowFunding: new Set(["read"]),
    Disbursements: new Set(["read"]),
    Workspaces: new Set(["read"]),
    Members: new Set(["read"]),
    Invitations: new Set(["read"]),
    Sponsors: new Set(["read"]),
    Milestones: new Set(["read"]),
    Disputes: new Set(["read", "create"]),
    Notifications: new Set(["read", "update"]),
  },
};

/**
 * Check if a role has permission to perform an action on a resource (Req 27.1).
 * Returns `true` if permitted, `false` otherwise.
 */
export function can(
  role: PlatformRole,
  resource: ResourceCategory,
  action: Action,
): boolean {
  const rolePermissions = MATRIX[role];
  if (!rolePermissions) return false;
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;
  return resourcePermissions.has(action);
}

/**
 * Authorize a request or throw `ForbiddenError` (Req 3.6, 3.7, 27.11).
 * Replaces the 15+ inline organizer checks. On denial, this logs an audit
 * record (actual audit write is plugged in by task 11.1).
 */
export function authorize(
  ctx: AuthContext,
  resource: ResourceCategory,
  action: Action,
): void {
  if (!can(ctx.role, resource, action)) {
    // TODO (task 11.1): emit audit permission-denied record here (Req 27.11)
    throw new ForbiddenError(
      `Role '${ctx.role}' cannot '${action}' on '${resource}'.`,
      { role: ctx.role, resource, action, userId: ctx.userId },
    );
  }
}

/**
 * Convenience helper for routes that require the organizer role or higher.
 * Replaces the ~15 copy-pasted inline `if (role !== 'Organizer')` checks.
 */
export function requireOrganizer(ctx: AuthContext): void {
  const organizerOrAbove: PlatformRole[] = [
    "PlatformAdmin",
    "WorkspaceOwner",
    "WorkspaceAdmin",
    "Organizer",
  ];
  if (!organizerOrAbove.includes(ctx.role)) {
    throw new ForbiddenError(
      "This action requires at least the Organizer role.",
      { role: ctx.role, userId: ctx.userId },
    );
  }
}
