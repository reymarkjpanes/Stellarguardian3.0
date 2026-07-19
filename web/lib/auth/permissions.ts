import { createServerClient } from "@/lib/supabase/server";

export type Role = "PlatformAdmin" | "WorkspaceAdmin" | "Organizer" | "Judge" | "Mentor" | "Participant" | "Owner" | "Member";

export type Action = "create" | "read" | "update" | "delete" | "transition" | "fund" | "join" | "submit" | "select";
export type Resource = "event" | "workspace" | "escrow" | "team" | "submission" | "evaluation" | "winner";

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Checks if the current authenticated user has the required workspace role.
 */
export async function requireWorkspaceRole(workspaceId: string, allowedRoles: Role[]) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new AuthError("UNAUTHENTICATED", "Authentication required.");
  }

  // Check PlatformAdmin first if applicable (depends on your DB structure)
  // For now, check workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !allowedRoles.includes(membership.role as Role)) {
    throw new AuthError("FORBIDDEN", "You do not have the required role in this workspace.");
  }

  return { user, role: membership.role as Role };
}

/**
 * Checks if the current authenticated user has the required event role.
 */
export async function requireEventRole(eventId: string, allowedRoles: Role[]) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new AuthError("UNAUTHENTICATED", "Authentication required.");
  }

  // 1. Check Event specific membership
  const { data: eventMembership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (eventMembership && allowedRoles.includes(eventMembership.role as Role)) {
    return { user, role: eventMembership.role as Role };
  }

  // 2. Check if they are a Workspace Admin/Owner for the workspace containing this event
  const { data: event } = await supabase
    .from("events")
    .select("workspace_id")
    .eq("id", eventId)
    .single();

  if (event) {
    const { data: wsMembership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", event.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (wsMembership && ["Owner", "WorkspaceAdmin"].includes(wsMembership.role)) {
      // Workspace Admins implicitly have Organizer-level access to all events
      if (allowedRoles.includes("Organizer")) {
         return { user, role: wsMembership.role as Role };
      }
    }
  }

  throw new AuthError("FORBIDDEN", "You do not have the required role for this event.");
}

/**
 * Centralized Action permission check based on the matrix.
 */
export async function requirePermission(resourceId: string, resourceType: "workspace" | "event", action: Action) {
  // A helper that maps actions to required roles
  const matrix: Record<"workspace" | "event", Record<Action, Role[]>> = {
    event: {
      create: ["WorkspaceAdmin", "Owner"],
      read: ["Participant", "Judge", "Mentor", "Organizer", "WorkspaceAdmin", "Owner"],
      update: ["Organizer", "WorkspaceAdmin", "Owner"],
      delete: ["WorkspaceAdmin", "Owner"],
      transition: ["Organizer", "WorkspaceAdmin", "Owner"],
      fund: ["Organizer", "WorkspaceAdmin", "Owner"],
      join: ["Participant"],
      submit: ["Participant"],
      select: ["Organizer", "WorkspaceAdmin", "Owner"],
    },
    workspace: {
      create: [], // Anyone authenticated can create
      read: ["Member", "WorkspaceAdmin", "Owner"],
      update: ["WorkspaceAdmin", "Owner"],
      delete: ["Owner"],
      transition: [], fund: [], join: [], submit: [], select: [] // Not applicable
    }
  };

  const allowedRoles = matrix[resourceType][action];
  
  if (resourceType === "workspace") {
    return requireWorkspaceRole(resourceId, allowedRoles);
  } else {
    return requireEventRole(resourceId, allowedRoles);
  }
}
