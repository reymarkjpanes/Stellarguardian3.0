/**
 * Sponsor and milestone schemas (Req 21).
 * Mirrors the `sponsors` and `milestones` tables from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";

export const SponsorTierSchema = z.enum(["Gold", "Silver", "Bronze"]);
export type SponsorTier = z.infer<typeof SponsorTierSchema>;

export const SponsorSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  name: z.string().min(1).max(200),
  logoUrl: z.url().nullable().optional(),
  tier: SponsorTierSchema,
});
export type Sponsor = z.infer<typeof SponsorSchema>;

export const MilestoneSchema = z.object({
  id: UuidSchema,
  eventId: UuidSchema,
  title: z.string().min(1).max(200),
  date: TimestampSchema,
  description: z.string().max(2000).nullable().optional(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;
