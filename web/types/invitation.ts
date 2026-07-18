/**
 * Invitation schemas (Req 10.3, 24.4).
 * Mirrors the `invitations` table from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";

export const InvitationScopeSchema = z.enum(["workspace", "team"]);
export type InvitationScope = z.infer<typeof InvitationScopeSchema>;

export const InvitationSchema = z.object({
  id: UuidSchema,
  scope: InvitationScopeSchema,
  scopeId: UuidSchema,
  inviterId: UuidSchema,
  inviteeEmail: z.email(),
  token: z.string().min(1),
  /** Workspace invitations expire at 7 days (Req 24.4). */
  expiresAt: TimestampSchema,
  acceptedAt: TimestampSchema.nullable().optional(),
});
export type Invitation = z.infer<typeof InvitationSchema>;

/** Request body for creating an invitation (Req 10.3, 24.4). */
export const CreateInvitationSchema = z.object({
  scope: InvitationScopeSchema,
  scopeId: UuidSchema,
  inviteeEmail: z.email(),
});
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

/** Request body for accepting an invitation via its token. */
export const AcceptInvitationSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;
