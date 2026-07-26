/**
 * EventRuleContext defines the data available to the Business Rule Engine
 * when evaluating if a transition is allowed.
 */
export interface EventRuleContext {
  judgeCount: number;
  registrationDeadline?: string;
  teamSizeMin?: number;
  hasSubmissions: boolean;
  allSubmissionsScored: boolean;
  escrowFullyFundedOnChain: boolean;
  reviewWindowElapsed: boolean;
  unresolvedDisputes: number;
  registrationCount: number;
  submissionCount: number;
  kycRequirementsSatisfied: boolean;
  minimumParticipantsMet: boolean;
}

/**
 * A BusinessRule evaluates the context and returns null if passing,
 * or an error string if failing.
 */
export type BusinessRule = (ctx: EventRuleContext) => string | null;

/**
 * EventBusinessRules defines the decoupled logic evaluated by the Workflow Engine.
 */
export const EventBusinessRules = {
  requiresJudges: (ctx: EventRuleContext) =>
    ctx.judgeCount >= 1 ? null : "Requires at least one judge assigned",
  requiresRegistrationDeadline: (ctx: EventRuleContext) =>
    ctx.registrationDeadline ? null : "Requires a registration deadline configured",
  zeroRegistrations: (ctx: EventRuleContext) =>
    ctx.registrationCount === 0 ? null : "Must have zero registrations to rollback",
  requiresTeamSizeMin: (ctx: EventRuleContext) =>
    ctx.teamSizeMin !== undefined ? null : "Requires teamSizeMin configured",
  zeroSubmissions: (ctx: EventRuleContext) =>
    ctx.submissionCount === 0 ? null : "Must have zero submissions to rollback",
  hasSubmissions: (ctx: EventRuleContext) =>
    ctx.hasSubmissions ? null : "Requires at least one submission",
  allSubmissionsScored: (ctx: EventRuleContext) =>
    ctx.allSubmissionsScored ? null : "All submissions must be scored",
  escrowFullyFunded: (ctx: EventRuleContext) =>
    ctx.escrowFullyFundedOnChain ? null : "Full escrow funding confirmed on-chain is required",
  reviewWindowElapsed: (ctx: EventRuleContext) =>
    ctx.reviewWindowElapsed ? null : "Review window must have elapsed",
  zeroUnresolvedDisputes: (ctx: EventRuleContext) =>
    ctx.unresolvedDisputes === 0 ? null : "Zero unresolved disputes required",
  minimumParticipantsMet: (ctx: EventRuleContext) =>
    ctx.minimumParticipantsMet ? null : "Minimum participants not met",
  kycSatisfied: (ctx: EventRuleContext) =>
    ctx.kycRequirementsSatisfied ? null : "Workspace KYC policies not met",
};
