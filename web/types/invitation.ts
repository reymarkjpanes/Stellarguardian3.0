/**
 * Invitation schemas (Req 10.3, 24.4).
 * Mirrors the `invitations` table from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";
import { InvitationTypeSchema, InvitationStateSchema } from "./enums";

export const InvitationSchema = z.object({
  id: UuidSchema,
  type: InvitationTypeSchema,
  targetId: UuidSchema,
  inviterId: UuidSchema,
  inviteeEmail: z.string().email(),
  token: z.string().min(10),
  status: InvitationStateSchema.default("Pending"),
  payload: z.record(z.string(), z.any()).nullable().optional(),
  expiresAt: TimestampSchema,
  acceptedAt: TimestampSchema.nullable().optional(),
  createdAt: TimestampSchema,
});
export type Invitation = z.infer<typeof InvitationSchema>;

/** Request body for creating an invitation (Req 10.3, 24.4). */
export const CreateInvitationSchema = z.object({
  type: InvitationTypeSchema,
  targetId: UuidSchema,
  inviteeEmail: z.string().email(),
  payload: z.record(z.string(), z.any()).optional(),
});
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

/** Request body for accepting an invitation via its token. */
export const AcceptInvitationSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;
