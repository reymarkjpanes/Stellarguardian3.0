/**
 * server/schemas/events.ts
 * Zod validation schemas for event-related write endpoints.
 * All schemas export both the schema and the inferred TypeScript type.
 */
import { z } from 'zod';

// ─── Shared constants ─────────────────────────────────────────────────────────

const EVENT_CATEGORIES = [
  'Hackathon', 'Competition', 'Challenge', 'Bounty', 'Grant',
] as const;

const EVENT_FORMATS = ['Online', 'In-Person', 'Hybrid'] as const;
const EVENT_VISIBILITY = ['Public', 'Private'] as const;

const VALID_STATES = [
  'Draft', 'Funded', 'Published', 'Registration Open',
  'Registration Closed', 'In Progress', 'Judging', 'Completed',
  'Cancelled', 'Archived',
] as const;

// ─── ISO date string refinement ───────────────────────────────────────────────
const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Must be a valid date string (ISO 8601)' },
);

// ─── Create Event ─────────────────────────────────────────────────────────────
export const CreateEventSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(10).max(5000).trim(),
  category: z.enum(EVENT_CATEGORIES),
  format: z.enum(EVENT_FORMATS),
  visibility: z.enum(EVENT_VISIBILITY),
  registrationDeadline: isoDateString,
  startDate: isoDateString,
  endDate: isoDateString,
  prizeTotal: z.number().min(0).max(10_000_000),
  prizeBreakdown: z.string().max(2000).optional(),
  tags: z.union([
    z.array(z.string().max(50)).max(20),
    z.string().max(500),
  ]).optional(),
  capacity: z.number().int().min(1).max(100_000).nullable().optional(),
  teamSizeMax: z.number().int().min(1).max(100).optional().default(4),
  bannerUrl: z.string().url().max(2000).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: 'startDate must be before endDate', path: ['endDate'] },
).refine(
  (data) => new Date(data.registrationDeadline) <= new Date(data.startDate),
  { message: 'registrationDeadline must be on or before startDate', path: ['registrationDeadline'] },
);

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

// ─── Update Event ─────────────────────────────────────────────────────────────
// All fields optional — partial update semantics.
export const UpdateEventSchema = z.object({
  title: z.string().min(3).max(200).trim().optional(),
  description: z.string().min(10).max(5000).trim().optional(),
  category: z.enum(EVENT_CATEGORIES).optional(),
  format: z.enum(EVENT_FORMATS).optional(),
  visibility: z.enum(EVENT_VISIBILITY).optional(),
  registrationDeadline: isoDateString.optional(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
  prizeTotal: z.number().min(0).max(10_000_000).optional(),
  prizeBreakdown: z.string().max(2000).optional(),
  tags: z.union([
    z.array(z.string().max(50)).max(20),
    z.string().max(500),
  ]).optional(),
  rulesPublished: z.boolean().optional(),
  timelineConfirmed: z.boolean().optional(),
  capacity: z.number().int().min(1).max(100_000).nullable().optional(),
  teamSizeMax: z.number().int().min(1).max(100).optional(),
  bannerUrl: z.string().url().max(2000).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
});

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// ─── State Transition ─────────────────────────────────────────────────────────
export const StateTransitionSchema = z.object({
  newState: z.enum(VALID_STATES),
});

export type StateTransitionInput = z.infer<typeof StateTransitionSchema>;

// ─── RSVP ─────────────────────────────────────────────────────────────────────
export const RsvpSchema = z.object({
  status: z.enum(['Going', 'Maybe', 'Not Going']),
});

export type RsvpInput = z.infer<typeof RsvpSchema>;

// ─── Membership Status ────────────────────────────────────────────────────────
export const MembershipStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'pending']),
});

export type MembershipStatusInput = z.infer<typeof MembershipStatusSchema>;

// ─── Milestones ───────────────────────────────────────────────────────────────
export const CreateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  date: isoDateString,
  description: z.string().max(1000).trim().optional(),
});

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;

// ─── Sponsors ─────────────────────────────────────────────────────────────────
export const CreateSponsorSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  logo: z.string().url().max(2000).optional(),
  tier: z.string().min(1).max(50).trim(),
});

export type CreateSponsorInput = z.infer<typeof CreateSponsorSchema>;

// ─── Winners ──────────────────────────────────────────────────────────────────
const WinnerEntrySchema = z.object({
  submissionId: z.number().int().positive(),
  rank: z.number().int().min(1).max(100),
  prizeAmount: z.number().min(0).max(10_000_000),
});

export const SetWinnersSchema = z.object({
  winners: z.array(WinnerEntrySchema).min(1).max(100),
});

export type SetWinnersInput = z.infer<typeof SetWinnersSchema>;
