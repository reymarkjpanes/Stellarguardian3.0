/**
 * Invitation service — manage workspace invitations (Req 24.3).
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { sendNotificationEmail } from "./email";

export interface InvitationRecord {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  invited_by: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  token: string;
  expires_at: string;
  created_at: string;
}

/**
 * Create a workspace invitation and send email notification.
 */
export async function createInvitation(params: {
  workspaceId: string;
  email: string;
  role: "Admin" | "Member";
  invitedBy: string;
  workspaceName: string;
}): Promise<{ success: boolean; invitation?: InvitationRecord; error?: string }> {
  const supabase = createServiceClient();

  // Generate a unique invitation token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      workspace_id: params.workspaceId,
      email: params.email,
      role: params.role,
      invited_by: params.invitedBy,
      status: "pending",
      token,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Send invitation email
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invitations/accept?token=${token}`;

  await sendNotificationEmail(
    params.email,
    `You've been invited to ${params.workspaceName}`,
    `You've been invited to join the workspace "${params.workspaceName}" as a ${params.role}. Click below to accept.`,
    inviteUrl,
  );

  return { success: true, invitation: invitation as InvitationRecord };
}

/**
 * Accept an invitation by token.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (!invitation) {
    return { success: false, error: "Invalid or expired invitation." };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await supabase.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
    return { success: false, error: "This invitation has expired." };
  }

  // Add user to workspace
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: invitation.workspace_id,
      user_id: userId,
      role: invitation.role,
    });

  if (memberError) {
    if (memberError.code === "23505") {
      return { success: false, error: "You are already a member of this workspace." };
    }
    return { success: false, error: memberError.message };
  }

  // Mark invitation as accepted
  await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);

  return { success: true };
}

/**
 * Revoke a pending invitation.
 */
export async function revokeInvitation(invitationId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("status", "pending");
  return !error;
}
