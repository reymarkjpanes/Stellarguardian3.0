/**
 * GET /api/invitations/preview?token=<uuid>
 *
 * Returns invitation context WITHOUT accepting it.
 * Used by the accept page to show trust signals before the user commits.
 * Validates token expiry and returns workspace + optional event data.
 */
import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Token is required." } },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data: invitation } = await supabase
      .from("invitations")
      .select("id, workspace_id, email, role, invited_by, status, expires_at, workspaces(name)")
      .eq("token", token)
      .single();

    if (!invitation) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Invitation not found." } },
        { status: 404 },
      );
    }

    if (invitation.status !== "pending") {
      const msg =
        invitation.status === "accepted"
          ? "This invitation has already been accepted."
          : invitation.status === "expired"
          ? "This invitation has expired."
          : "This invitation has been revoked.";
      return Response.json(
        { error: { code: "CONFLICT", message: msg } },
        { status: 409 },
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      // Mark expired
      await supabase.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
      return Response.json(
        { error: { code: "GONE", message: "This invitation has expired." } },
        { status: 410 },
      );
    }

    // Fetch inviter display name
    const { data: inviter } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", invitation.invited_by)
      .single();

    const workspaceName =
      (invitation.workspaces as unknown as { name: string } | null)?.name ?? "Unknown Workspace";

    // Preview response — no event context for workspace invitations (that's fine)
    return okResponse({
      workspace_id: invitation.workspace_id,
      workspace_name: workspaceName,
      role: invitation.role,
      email: invitation.email,
      invited_by: inviter?.display_name ?? "Workspace owner",
      event: null, // Workspace invitations don't have event context
      judge_count: 0,
      organizer_verified: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
