/**
 * User entity schemas (Req 1.5).
 * Mirrors the `users` table (extends Supabase `auth.users`) from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";

export const UserSchema = z.object({
  id: UuidSchema,
  displayName: z.string().min(1).max(120),
  email: z.email(),
  deactivatedAt: TimestampSchema.nullable().optional(),
  termsAcceptedVersion: z.string().nullable().optional(),
  termsAcceptedAt: TimestampSchema.nullable().optional(),
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

/** Payload for creating/updating a user's public profile fields. */
export const UpdateUserProfileSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
});
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
