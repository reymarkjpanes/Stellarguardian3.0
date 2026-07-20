/**
 * Event entity schemas (Req 12, 23).
 * Mirrors the `events` and `event_members` tables from design.md.
 */
import { z } from "zod";
import { AmountSchema, TimestampSchema, UuidSchema, VersionSchema } from "./common";
import { EventStateSchema, NetworkModeSchema } from "./enums";

export const EventMemberRoleSchema = z.enum([
  "Organizer",
  "Judge",
  "Participant",
  "Sponsor",
  "Mentor",
]);
export type EventMemberRole = z.infer<typeof EventMemberRoleSchema>;

export const ResubmissionPolicySchema = z.object({
  allowed: z.boolean().default(true),
  maxResubmissions: z.int().nonnegative().optional(),
});
export type ResubmissionPolicy = z.infer<typeof ResubmissionPolicySchema>;

export const FilePolicySchema = z.object({
  allowedMimeTypes: z.array(z.string()).default([]),
  maxFileSizeBytes: z.int().positive().optional(),
  maxTotalSizeBytes: z.int().positive().optional(),
});
export type FilePolicy = z.infer<typeof FilePolicySchema>;

export const EventSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  organizerId: UuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(10_000),
  tags: z.array(z.string().min(1).max(50)).default([]),
  category: z.string().min(1),
  format: z.string().min(1),
  state: EventStateSchema,
  reviewWindowHours: z.int().min(24).max(168).default(72),
  teamSizeMin: z.int().positive(),
  teamSizeMax: z.int().positive(),
  registrationDeadline: TimestampSchema.nullable().optional(),
  prizePoolTarget: AmountSchema.nullable().optional(),
  networkMode: NetworkModeSchema,
  resubmissionPolicy: ResubmissionPolicySchema.default({ allowed: true }),
  filePolicy: FilePolicySchema.default({ allowedMimeTypes: [] }),
  retentionDays: z.int().positive().default(90),
  version: VersionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Event = z.infer<typeof EventSchema>;

export { AvailabilitySchema } from "./enums";
import { AvailabilitySchema } from "./enums";

export const EventMemberSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  userId: UuidSchema,
  role: EventMemberRoleSchema,
  availability: AvailabilitySchema.default("Unavailable"),
  // Include nested fields for UI typing
  users: z.any().optional(),
  profileMissing: z.array(z.string()).optional(),
  inTeam: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
});
export type EventMember = z.infer<typeof EventMemberSchema>;

/** Request body for creating an event (Req 12.1). */
export const CreateEventSchema = z.object({
  workspaceId: UuidSchema,
  title: EventSchema.shape.title,
  description: EventSchema.shape.description,
  tags: EventSchema.shape.tags.optional(),
  category: EventSchema.shape.category,
  format: EventSchema.shape.format,
  reviewWindowHours: EventSchema.shape.reviewWindowHours.optional(),
  teamSizeMin: EventSchema.shape.teamSizeMin,
  teamSizeMax: EventSchema.shape.teamSizeMax,
  registrationDeadline: TimestampSchema.optional(),
  prizePoolTarget: AmountSchema.optional(),
  networkMode: NetworkModeSchema,
});
export type CreateEvent = z.infer<typeof CreateEventSchema>;

/** Request body for transitioning an event's state (Req 6.4, 23.5). */
export const TransitionEventStateSchema = z.object({
  toState: EventStateSchema,
  version: VersionSchema,
});
export type TransitionEventState = z.infer<typeof TransitionEventStateSchema>;
