/**
 * Route-handler authorization helper (Task 4.2).
 *
 * Thin wrapper over PermissionEngine that:
 *   1. Resolves the current user's roles from workspace_members + event_members
 *   2. Builds a PermissionContext
 *   3. Calls PermissionEngine.require() — throws ForbiddenError (403) on denial
 *
 * Usage in route handlers:
 *   await authorize(userId, "Events", "update", { eventState: event.state, eventId });
 *
 * This replaces the legacy requireEventRole / requireWorkspaceRole helpers.
 * Those remain for backward compat but are @deprecated.
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  PermissionEngine,
  type PermissionContext,
} from "@/lib/engines/permission/permission-engine";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import type { PlatformRole, ResourceCategory, Action } from "@/types";

/**
 * Resolve all platform roles for a user.
 * Merges workspace-level and event-level roles.
 */
async function getUserRoles(
  userId: string,
  context?: { workspaceId?: string; eventId?: string },
): Promise<PlatformRole[]> {
  const supabase = createServiceClient();
  const roles = new Set<PlatformRole>();

  // Check for PlatformAdmin flag on the user profile
  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.is_platform_admin) {
    roles.add("PlatformAdmin");
  }

  // Workspace-level roles
  if (context?.workspaceId) {
    const { data: wsMemberships } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", context.workspaceId)
      .eq("user_id", userId);

    for (const m of wsMemberships ?? []) {
      roles.add(m.role as PlatformRole);
    }
  }

  // Event-level roles (also resolve the workspace through the event)
  if (context?.eventId) {
    const { data: eventMemberships } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", context.eventId)
      .eq("user_id", userId);

    for (const m of eventMemberships ?? []) {
      roles.add(m.role as PlatformRole);
    }

    // If the user is a workspace member for the event's workspace, add that role too
    if (!context.workspaceId) {
      const { data: eventRow } = await supabase
        .from("events")
        .select("workspace_id")
        .eq("id", context.eventId)
        .maybeSingle();

      if (eventRow?.workspace_id) {
        const { data: wsMemberships } = await supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", eventRow.workspace_id)
          .eq("user_id", userId);

        for (const m of wsMemberships ?? []) {
          roles.add(m.role as PlatformRole);
        }
      }
    }
  }

  return Array.from(roles);
}

/**
 * Authorize the current user for a given resource + action.
 * Throws `UnauthenticatedError` (401) if userId is empty.
 * Throws `ForbiddenError` (403) if no role grants the action.
 */
export async function authorize(
  userId: string | null | undefined,
  resourceCategory: ResourceCategory | string,
  action: Action | string,
  options?: {
    eventId?: string;
    workspaceId?: string;
    attributes?: PermissionContext["attributes"];
  },
): Promise<void> {
  if (!userId) {
    throw new UnauthenticatedError();
  }

  const userRoles = await getUserRoles(userId, {
    eventId: options?.eventId,
    workspaceId: options?.workspaceId,
  });

  const ctx: PermissionContext = {
    userId,
    userRoles,
    resourceCategory,
    action,
    attributes: options?.attributes,
  };

  if (!PermissionEngine.can(ctx)) {
    throw new ForbiddenError(
      `Roles [${userRoles.join(", ")}] cannot "${action}" on "${resourceCategory}".`,
    );
  }
}
