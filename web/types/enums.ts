/**
 * Canonical enums shared across entity schemas (Req 1.5).
 *
 * These mirror the Shared State Machine Module (`/lib/state-machine`, Req 6, 23)
 * and Permission Matrix (`/lib/services/permission`, Req 27, 3.7) type definitions
 * from the design document. They are defined here as Zod enums so every entity
 * schema that references a lifecycle state or role can import a single
 * source-of-truth validator instead of redeclaring string literals.
 */
import { z } from "zod";

/** Canonical event lifecycle states (Req 23.1) — 16 states. */
export const EventStateSchema = z.enum([
  "Draft",
  "Review",
  "Published",
  "RegistrationOpen",
  "RegistrationClosed",
  "TeamFormationLocked",
  "SubmissionOpen",
  "SubmissionClosed",
  "JudgingRound1",
  "JudgingRound2",
  "WinnerVerification",
  "DisputeWindow",
  "PrizeApproved",
  "EscrowRelease",
  "Completed",
  "Cancelled",
  "Suspended",
  "Archived",
]);
export type EventState = z.infer<typeof EventStateSchema>;

/** Escrow lifecycle states (Req 26.1) — 9 states. */
export const EscrowStateSchema = z.enum([
  "PendingFunding",
  "PartiallyFunded",
  "FullyFunded",
  "Locked",
  "PendingRelease",
  "Released",
  "Refunded",
  "Failed",
  "Cancelled",
]);
export type EscrowState = z.infer<typeof EscrowStateSchema>;

/** Dispute lifecycle states (Req 39.1) — 5 states. */
export const DisputeStateSchema = z.enum([
  "Open",
  "UnderReview",
  "Upheld",
  "Dismissed",
  "Withdrawn",
]);
export type DisputeState = z.infer<typeof DisputeStateSchema>;

/** Platform-wide roles used by the permission matrix (Req 27). */
export const PlatformRoleSchema = z.enum([
  "PlatformAdmin",
  "WorkspaceOwner",
  "WorkspaceAdmin",
  "Organizer",
  "Sponsor",
  "Judge",
  "Mentor",
  "Participant",
  "TeamCaptain",
  "TeamMember",
]);
export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

/** Resource categories governed by the permission matrix (Req 27). */
export const ResourceCategorySchema = z.enum([
  "Events",
  "Submissions",
  "Evaluations",
  "Teams",
  "EscrowFunding",
  "Disbursements",
  "Workspaces",
  "Members",
  "Invitations",
  "Sponsors",
  "Milestones",
  "Disputes",
  "Notifications",
]);
export type ResourceCategory = z.infer<typeof ResourceCategorySchema>;

/** Actions governed by the permission matrix (Req 27). */
export const ActionSchema = z.enum(["read", "create", "update", "delete", "approve", "reject"]);
export type Action = z.infer<typeof ActionSchema>;

/** Network mode gating mainnet financial operations (Req 25.5, 34.3). */
export const NetworkModeSchema = z.enum(["testnet", "mainnet"]);
export type NetworkMode = z.infer<typeof NetworkModeSchema>;
