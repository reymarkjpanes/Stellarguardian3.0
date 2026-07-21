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
  "Archived",
]);
export type EventState = z.infer<typeof EventStateSchema>;

/** Operational phases of an event */
export const EventPhaseSchema = z.enum([
  "Setup",
  "Registration",
  "Team Building",
  "Submission",
  "Judging",
  "Completed",
]);
export type EventPhase = z.infer<typeof EventPhaseSchema>;

/** Event visibility */
export const VisibilitySchema = z.enum(["Private", "Workspace", "Public"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

/** Team lifecycle states */
export const TeamStatusSchema = z.enum(["Recruiting", "Ready", "Locked", "Disbanded"]);
export type TeamStatus = z.infer<typeof TeamStatusSchema>;

/** Member availability */
export const AvailabilitySchema = z.enum([
  "Available",
  "Busy",
  "Looking for Team",
  "Looking for Mentor",
  "Looking for Members",
  "Unavailable",
]);
export type Availability = z.infer<typeof AvailabilitySchema>;

/** Invitation states */
export const InvitationStateSchema = z.enum([
  "Pending",
  "Accepted",
  "Declined",
  "Cancelled",
  "Expired",
]);
export type InvitationState = z.infer<typeof InvitationStateSchema>;

/** Invitation Types */
export const InvitationTypeSchema = z.enum([
  "workspace",
  "event",
  "team",
  "judge_assignment",
  "mentor_assignment",
]);
export type InvitationType = z.infer<typeof InvitationTypeSchema>;

/** Submission lifecycle states */
export const SubmissionStateSchema = z.enum([
  "Not Started",
  "Draft",
  "Submitted",
  "Locked",
  "Under Review",
  "Evaluated",
]);
export type SubmissionState = z.infer<typeof SubmissionStateSchema>;

/** Evaluation lifecycle states */
export const EvaluationStateSchema = z.enum([
  "Assigned",
  "Draft",
  "Submitted",
  "Flagged",
  "Finalized",
]);
export type EvaluationState = z.infer<typeof EvaluationStateSchema>;

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
