import { PlatformRole, ResourceCategory, Action, EventState } from "@/types";

/**
 * PermissionContext represents the acting user, the resource they are targeting,
 * and contextual attributes necessary for Attribute-Based Access Control (ABAC).
 */
export interface PermissionContext {
  userId: string;
  userRoles: PlatformRole[];
  resourceCategory: ResourceCategory | string;
  action: Action | string;
  attributes?: {
    eventState?: EventState;
    assignedSubmissionIds?: string[];
    targetSubmissionId?: string;
    isOwner?: boolean;
    complianceFlagExists?: boolean;
    isFreezeAction?: boolean;
    [key: string]: unknown;
  };
}

/**
 * An AbacValidator evaluates runtime contextual attributes to determine authorization.
 */
export type AbacValidator = (ctx: PermissionContext) => boolean;

interface RolePermissions {
  [category: string]: {
    [action: string]: boolean | AbacValidator;
  };
}

/**
 * The unified RBAC + ABAC Permission Matrix.
 * Translates static roles into dynamic rules using contextual attributes.
 */
const MATRIX: Partial<Record<PlatformRole, RolePermissions>> = {
  PlatformAdmin: {
    Events: {
      update: (ctx) => {
        // Admin can freeze event ONLY if compliance flag exists (example ABAC rule)
        if (ctx.attributes?.isFreezeAction) {
          return !!ctx.attributes?.complianceFlagExists;
        }
        return true;
      }
    }
  },
  Organizer: {
    Events: {
      update: (ctx) => {
        // Organizer can edit ONLY before registration closes (ABAC rule)
        const state = ctx.attributes?.eventState;
        if (!state) return true; // if no state provided, assume true for generic updates
        return ["Draft", "Review", "Published", "RegistrationOpen"].includes(state);
      }
    }
  },
  Judge: {
    Submissions: {
      read: true,
      evaluate: (ctx) => {
        // Judge can only judge assigned submissions (ABAC rule)
        const target = ctx.attributes?.targetSubmissionId;
        const assigned = ctx.attributes?.assignedSubmissionIds || [];
        if (!target) return false;
        return assigned.includes(target);
      }
    }
  }
};

export const PermissionEngine = {
  /**
   * Evaluates if the current context has permission to execute the action.
   * Checks across all roles the user possesses.
   */
  can: (ctx: PermissionContext): boolean => {
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
   * Enforces permission and throws an Error if denied.
   */
  require: (ctx: PermissionContext): void => {
    if (!PermissionEngine.can(ctx)) {
      throw new Error(`Permission denied for roles [${ctx.userRoles.join(",")}] to execute '${ctx.action}' on '${ctx.resourceCategory}'.`);
    }
  }
};
