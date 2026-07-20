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
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  deactivatedAt: TimestampSchema.nullable().optional(),
  termsAcceptedVersion: z.string().nullable().optional(),
  termsAcceptedAt: TimestampSchema.nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.optional(),
});
export type User = z.infer<typeof UserSchema>;

export const SkillSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
  category: z.string().min(1),
});
export type Skill = z.infer<typeof SkillSchema>;

export const UserSkillSchema = z.object({
  userId: UuidSchema,
  skillId: UuidSchema,
  level: z.number().min(1).max(5),
  yearsExperience: z.number().nullable().optional(),
  skill: SkillSchema.optional(), // joined
});
export type UserSkill = z.infer<typeof UserSkillSchema>;

export const UserLinkSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  type: z.enum(['GitHub', 'Portfolio', 'LinkedIn', 'Twitter', 'YouTube', 'Devpost', 'Behance', 'Dribbble', 'Medium', 'Website']),
  url: z.string().url(),
});
export type UserLink = z.infer<typeof UserLinkSchema>;

export const UserPresenceSchema = z.object({
  userId: UuidSchema,
  status: z.enum(['Online', 'Away', 'Offline']),
  device: z.enum(['web', 'mobile', 'desktop']),
  updatedAt: TimestampSchema,
});
export type UserPresence = z.infer<typeof UserPresenceSchema>;

/** Payload for creating/updating a user's public profile fields. */
export const UpdateUserProfileSchema = UserSchema.omit({ id: true, email: true, createdAt: true, updatedAt: true, termsAcceptedAt: true, termsAcceptedVersion: true, deactivatedAt: true }).partial();
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
