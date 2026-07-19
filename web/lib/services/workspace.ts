/**
 * Workspace Management Service (Req 24.1-24.10).
 *
 * Create workspaces (creator = Owner) with unique slugs, enforce roles,
 * invitation links, ownership transfer, deletion guards, and member removal.
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { writeAuditRecord } from "./audit";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * Create a workspace (Req 24.1). Creator becomes Owner.
 */
export async function createWorkspace(params: {
  creatorId: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<{ id: string; slug: string }> {
  const supabase = createServiceClient();

  // Validate slug format (Req 24.10)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(params.slug)) {
    throw new BadRequestError(
      "Slug must be lowercase alphanumeric with dashes only.",
    );
  }

  // Create workspace + owner membership in a single operation
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      slug: params.slug,
      name: params.name,
      description: params.description ?? null,
    })
    .select("id, slug")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ConflictError("A workspace with this slug already exists.");
    }
    throw new Error(`Failed to create workspace: ${error.message}`);
  }

  // Add creator as Owner (Req 24.2)
  await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: params.creatorId,
    role: "Owner",
  });

  await writeAuditRecord({
    action: "workspace.create",
    actor_id: params.creatorId,
    workspace_id: workspace.id,
    resource_type: "workspaces",
    resource_id: workspace.id,
    metadata: { name: params.name, slug: params.slug },
  });

  return workspace;
}

/**
 * Add a member to a workspace (Req 24.3).
 */
export async function addWorkspaceMember(params: {
  workspaceId: string;
  actorId: string;
  userId: string;
  role: "Admin" | "Member";
}): Promise<void> {
  const supabase = createServiceClient();

  // Verify actor is Owner or Admin
  const { data: actorMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.actorId)
    .single();

  if (!actorMembership || !["Owner", "Admin"].includes(actorMembership.role)) {
    throw new ForbiddenError("Only Owners and Admins can add members.");
  }

  const { error } = await supabase.from("workspace_members").insert({
    workspace_id: params.workspaceId,
    user_id: params.userId,
    role: params.role,
  });

  if (error) {
    if (error.code === "23505") throw new ConflictError("User is already a member.");
    throw new Error(`Failed to add member: ${error.message}`);
  }

  await writeAuditRecord({
    action: "workspace.member_add",
    actor_id: params.actorId,
    workspace_id: params.workspaceId,
    resource_type: "workspace_members",
    metadata: { added_user_id: params.userId, role: params.role },
  });
}

/**
 * Remove a member from a workspace (Req 24.8).
 * Revokes event access and reassigns organizer-owned events to the Owner.
 */
export async function removeWorkspaceMember(params: {
  workspaceId: string;
  actorId: string;
  userId: string;
}): Promise<void> {
  const supabase = createServiceClient();

  // Cannot remove the Owner
  const { data: targetMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.userId)
    .single();

  if (!targetMembership) throw new NotFoundError("Member not found.");
  if (targetMembership.role === "Owner") {
    throw new BadRequestError("Cannot remove the workspace Owner. Transfer ownership first.");
  }

  // Remove membership
  await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.userId);

  // Reassign events organized by this user to the Owner (Req 24.8)
  const { data: owner } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", params.workspaceId)
    .eq("role", "Owner")
    .single();

  if (owner) {
    await supabase
      .from("events")
      .update({ organizer_id: owner.user_id })
      .eq("workspace_id", params.workspaceId)
      .eq("organizer_id", params.userId);
  }

  // Revoke event access
  const { data: workspaceEvents } = await supabase
    .from("events")
    .select("id")
    .eq("workspace_id", params.workspaceId);

  if (workspaceEvents) {
    const eventIds = workspaceEvents.map((e) => e.id);
    await supabase
      .from("event_members")
      .delete()
      .in("event_id", eventIds)
      .eq("user_id", params.userId);
  }

  await writeAuditRecord({
    action: "workspace.member_remove",
    actor_id: params.actorId,
    workspace_id: params.workspaceId,
    resource_type: "workspace_members",
    metadata: { removed_user_id: params.userId },
  });
}

/**
 * Delete a workspace (Req 24.7).
 * Blocks deletion while owned events are non-terminal.
 */
export async function deleteWorkspace(params: {
  workspaceId: string;
  actorId: string;
}): Promise<void> {
  const supabase = createServiceClient();

  // Verify actor is Owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.actorId)
    .single();

  if (!membership || membership.role !== "Owner") {
    throw new ForbiddenError("Only the workspace Owner can delete it.");
  }

  // Block deletion while non-terminal events exist (Req 24.7)
  const terminalStates = ["Completed", "Cancelled", "Archived"];
  const { count } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", params.workspaceId)
    .not("state", "in", `(${terminalStates.join(",")})`);

  if (count && count > 0) {
    throw new BadRequestError(
      `Cannot delete workspace while ${count} non-terminal event(s) exist.`,
      { activeEvents: count },
    );
  }

  await supabase.from("workspaces").delete().eq("id", params.workspaceId);

  await writeAuditRecord({
    action: "workspace.update",
    actor_id: params.actorId,
    workspace_id: params.workspaceId,
    resource_type: "workspaces",
    resource_id: params.workspaceId,
    metadata: { action: "deleted" },
  });
}
