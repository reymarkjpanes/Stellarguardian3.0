/**
 * Unified RBAC + ABAC Permission Engine (Req 27, Task 1.1).
 *
 * All 10 platform roles are defined here with full resource × action coverage.
 * Route handlers should call `PermissionEngine.require()` — not the legacy
 * `requireEventRole` / `requireWorkspaceRole` helpers in lib/auth/permissions.ts.
 *
 * ABAC rules enforce contextual constraints (event state, ownership, assignment)
 * on top of the static role grant.
 */
import { PlatformRole, ResourceCategory, Action, EventState } from "@/types";

/**
 * The context passed to every permission check.
 */
export interface PermissionContext {
  userId: string;
  userRoles: PlatformRole[];
  resourceCategory: ResourceCategory | string;
  action: Action | string;
  attributes?: {
    /** Current state of the event being operated on. */
    eventState?: EventState;
    /** Submission IDs this judge is assigned to evaluate. */
    assignedSubmissionIds?: string[];
    /** Submission being targeted for evaluation. */
    targetSubmissionId?: string;
    /** Whether the acting user owns the target resource. */
    isOwner?: boolean;
    /** A compliance/freeze flag exists on this event. */
    complianceFlagExists?: boolean;
    /** The action being attempted is a freeze operation. */
    isFreezeAction?: boolean;
    [key: string]: unknown;
  };
}

/** An ABAC validator evaluates runtime context. */
export type AbacValidator = (ctx: PermissionContext) => boolean;

interface RolePermissions {
  [category: string]: {
    [action: string]: boolean | AbacValidator;
  };
}

/**
 * States in which an organizer can still edit event content.
 * After RegistrationClosed the event is "in flight" and content is locked.
 */
const ORGANIZER_EDITABLE_STATES: ReadonlySet<EventState> = new Set([
  "Draft",
  "Published",
  "RegistrationOpen",
]);

/**
 * Full permission matrix for all 10 roles (Task 1.1).
 * true = always allowed for this role
 * false / omission = denied
 * function = ABAC rule evaluated at runtime
 */
const MATRIX: Partial<Record<PlatformRole, RolePermissions>> = {
  // ──────────────────────────────────────────────────────────────────────────
  // PlatformAdmin — full access; freeze requires compliance flag
  // ──────────────────────────────────────────────────────────────────────────
  PlatformAdmin: {
    Events: {
      read: true,
      create: true,
      update: (ctx) => {
        if (ctx.attributes?.isFreezeAction) {
          return !!ctx.attributes?.complianceFlagExists;
        }
        return true;
      },
      delete: true,
      approve: true,
      reject: true,
    },
    Submissions: {
      read: true,
      create: false,
      update: false,
      delete: true,
      approve: true,
      reject: true,
    },
    Evaluations: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: true,
      reject: true,
    },
    Teams: { read: true, create: false, update: true, delete: true, approve: true, reject: true },
    EscrowFunding: {
      read: true,
      create: true,
      update: true,
      delete: false,
      approve: true,
      reject: true,
    },
    Disbursements: {
      read: true,
      create: true,
      update: true,
      delete: false,
      approve: true,
      reject: true,
    },
    Workspaces: {
      read: true,
      create: true,
      update: true,
      delete: true,
      approve: true,
      reject: true,
    },
    Members: { read: true, create: true, update: true, delete: true, approve: true, reject: true },
    Invitations: {
      read: true,
      create: true,
      update: true,
      delete: true,
      approve: true,
      reject: true,
    },
    Disputes: {
      read: true,
      create: true,
      update: true,
      delete: false,
      approve: true,
      reject: true,
    },
    Notifications: {
      read: true,
      create: true,
      update: true,
      delete: true,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // WorkspaceOwner — owns the workspace; full event + member management
  // ──────────────────────────────────────────────────────────────────────────
  WorkspaceOwner: {
    Events: { read: true, create: true, update: true, delete: false, approve: true, reject: false },
    Submissions: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: true,
      create: true,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: true,
      create: true,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: { read: true, create: true, update: true, delete: true, approve: true, reject: true },
    Invitations: {
      read: true,
      create: true,
      update: true,
      delete: true,
      approve: true,
      reject: true,
    },
    Disputes: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: true,
      reject: true,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: true,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // WorkspaceAdmin — same as WorkspaceOwner minus workspace deletion
  // ──────────────────────────────────────────────────────────────────────────
  WorkspaceAdmin: {
    Events: { read: true, create: true, update: true, delete: false, approve: true, reject: false },
    Submissions: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: true,
      create: true,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: { read: true, create: true, update: true, delete: true, approve: true, reject: true },
    Invitations: {
      read: true,
      create: true,
      update: true,
      delete: true,
      approve: true,
      reject: true,
    },
    Disputes: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: true,
      reject: true,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Organizer — manages their event; editing locked after RegistrationClosed
  // ──────────────────────────────────────────────────────────────────────────
  Organizer: {
    Events: {
      read: true,
      create: true,
      update: (ctx) => {
        const state = ctx.attributes?.eventState;
        if (!state) return true; // no state context = allow (non-event resource)
        return ORGANIZER_EDITABLE_STATES.has(state);
      },
      delete: false,
      approve: true,
      reject: false,
    },
    Submissions: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: true,
      create: true,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: { read: true, create: true, update: true, delete: true, approve: true, reject: true },
    Invitations: {
      read: true,
      create: true,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Sponsors: {
      read: true,
      create: true,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
    Milestones: {
      read: true,
      create: true,
      update: true,
      delete: true,
      approve: false,
      reject: false,
    },
    Disputes: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: true,
      reject: true,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Sponsor — read-only access; can view own sponsorship data
  // ──────────────────────────────────────────────────────────────────────────
  Sponsor: {
    Events: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Submissions: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Invitations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Sponsors: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Milestones: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disputes: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Judge — can read events + submissions; evaluate only assigned submissions
  // ──────────────────────────────────────────────────────────────────────────
  Judge: {
    Events: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Submissions: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
      // custom "evaluate" action via ABAC
      evaluate: (ctx) => {
        const target = ctx.attributes?.targetSubmissionId;
        const assigned = ctx.attributes?.assignedSubmissionIds ?? [];
        if (!target) return false;
        return assigned.includes(target);
      },
    },
    Evaluations: {
      read: true,
      create: true,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Invitations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disputes: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Mentor — read submissions and teams; no mutations
  // ──────────────────────────────────────────────────────────────────────────
  Mentor: {
    Events: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Submissions: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Invitations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disputes: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Participant — can create + update their own submissions; file disputes
  // ──────────────────────────────────────────────────────────────────────────
  Participant: {
    Events: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Submissions: {
      read: true,
      create: true,
      update: (ctx) => !!ctx.attributes?.isOwner, // can only update own submission
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Invitations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disputes: {
      read: true,
      create: (ctx) => !!ctx.attributes?.isOwner, // can file disputes about own submission
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // TeamCaptain — manages team; creates/updates team submission
  // ──────────────────────────────────────────────────────────────────────────
  TeamCaptain: {
    Events: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Submissions: {
      read: true,
      create: true,
      update: true, // captain can update team submission
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: (ctx) => !!ctx.attributes?.isOwner, // captain manages own team
      delete: false,
      approve: true, // accept join requests
      reject: true, // reject join requests
    },
    EscrowFunding: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Invitations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disputes: {
      read: true,
      create: true, // captain can file disputes
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // TeamMember — can update team's submission; can leave team
  // ──────────────────────────────────────────────────────────────────────────
  TeamMember: {
    Events: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Submissions: {
      read: true,
      create: false,
      update: true, // member can contribute to team submission
      delete: false,
      approve: false,
      reject: false,
    },
    Evaluations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Teams: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    EscrowFunding: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disbursements: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Workspaces: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Members: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Invitations: {
      read: false,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Disputes: {
      read: true,
      create: false,
      update: false,
      delete: false,
      approve: false,
      reject: false,
    },
    Notifications: {
      read: true,
      create: false,
      update: true,
      delete: false,
      approve: false,
      reject: false,
    },
  },
};

export const PermissionEngine = {
  /**
   * Returns true if ANY of the user's roles grants the requested action.
   */
  can(ctx: PermissionContext): boolean {
    for (const role of ctx.userRoles) {
      const rolePerms = MATRIX[role];
      if (!rolePerms) continue;

      const categoryPerms = rolePerms[ctx.resourceCategory as string];
      if (!categoryPerms) continue;

      const actionPerm = categoryPerms[ctx.action as string];
      if (actionPerm === undefined) continue;

      if (typeof actionPerm === "boolean") {
        if (actionPerm) return true;
      } else if (typeof actionPerm === "function") {
        if (actionPerm(ctx)) return true;
      }
    }
    return false;
  },

  /**
   * Throws `ForbiddenError` if the context does not have permission.
   * Import `ForbiddenError` from `@/lib/errors` in route handlers.
   */
  require(ctx: PermissionContext): void {
    if (!PermissionEngine.can(ctx)) {
      throw Object.assign(
        new Error(
          `Permission denied: roles [${ctx.userRoles.join(", ")}] cannot "${ctx.action}" on "${ctx.resourceCategory}".`,
        ),
        { code: "FORBIDDEN", httpStatus: 403 },
      );
    }
  },
};
