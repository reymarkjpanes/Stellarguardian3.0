/**
 * POST /api/invitations/accept — Accept a workspace invitation by token.
 *
 * Requires authentication. Validates token, checks expiry, adds user to workspace.
 */
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { okResponse } from "@/lib/errors/responses";
import { acceptInvitation } from "@/lib/services/invitation";
import { withErrorHandling } from "@/lib/errors/with-error-handling";

const AcceptSchema = z.object({
  token: z.string().uuid("Invalid invitation token"),
});
export const POST = withErrorHandling(async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        {
          error: { code: "UNAUTHENTICATED", message: "Please sign in to accept this invitation." },
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = AcceptSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid token format." } },
        { status: 422 },
      );
    }

    const result = await acceptInvitation(parsed.data.token, user.id);

    if (!result.success) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: result.error } },
        { status: 400 },
      );
    }

    // Get workspace name for the response
    const { data: invitation } = await supabase
      .from("invitations")
      .select("workspace_id, workspaces(name)")
      .eq("token", parsed.data.token)
      .single();

    const workspaceName = (invitation as Record<string, unknown>)?.workspaces
      ? ((invitation as Record<string, unknown>).workspaces as { name: string }).name
      : "Workspace";

    return okResponse({ accepted: true, workspace_name: workspaceName });
  } catch (error) {
    return handleApiError(error);
  }
});
