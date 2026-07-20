/**
 * Team formation schemas (Req 10).
 * Mirrors the `teams` and `team_members` tables from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema, VersionSchema } from "./common";

export const TeamSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  name: z.string().min(1).max(120),
  captainId: UuidSchema,
  version: VersionSchema,
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMembershipSchema = z.object({
  id: UuidSchema,
  teamId: UuidSchema,
  eventMemberId: UuidSchema,
  role: z.enum(["Captain", "Member"]),
  joinedAt: TimestampSchema,
});
export type TeamMembership = z.infer<typeof TeamMembershipSchema>;

/** Request body for creating a team (Req 10.1). */
export const CreateTeamSchema = z.object({
  eventId: UuidSchema,
  name: TeamSchema.shape.name,
});
export type CreateTeam = z.infer<typeof CreateTeamSchema>;
