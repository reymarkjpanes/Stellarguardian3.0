# Original User Request

## Initial Request — 2026-08-01T15:09:51+08:00

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Fix the gaps in the Organizer Journey of Stellar Guardian 3.0 to ensure a robust end-to-end event management experience.

Working directory: c:\Users\Reymark\Documents\Antigravity-Project\stellar-guardian-3.0
Integrity mode: demo

## Requirements

### R1. Organizer Onboarding Flow
Implement a dedicated `/onboarding` page that blocks access to `/dashboard` until the user provides their display name and creates a default workspace. 

### R2. Event Lifecycle State Machine Alignment
Add explicit state transition buttons on the Event Dashboard to manually progress the event lifecycle. Require confirmation dialogs for irreversible actions (e.g., "Lock Submissions", "Start Judging").

### R3. Automated Escrow Trigger
Create an automated background job or API webhook endpoint that watches for the `PrizeApproved` state to automatically trigger the on-chain payout via the existing Soroban contracts, removing the need for manual platform intervention.

## Acceptance Criteria

### Onboarding
- [ ] Users without a workspace are redirected from `/dashboard` to `/onboarding`.
- [ ] Submitting the onboarding form successfully creates a workspace and redirects to `/dashboard`.

### Event Lifecycle
- [ ] Event detail page displays explicit transition buttons based on the current granular DB state.
- [ ] Transitioning states triggers the correct backend state update without UI divergence.

### Escrow Automation
- [ ] Reaching the `PrizeApproved` state automatically invokes the payout logic.

## Follow-up — 2026-08-01T20:44:55+08:00

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Perform a comprehensive, project-wide validation and audit of Stellar Guardian 3.0 across architecture, UI/UX design, performance, security, and error handling. Output a prioritized, actionable spec-driven implementation plan for final polish and production readiness. Do not implement the fixes; output a comprehensive report and plan first.

Working directory: c:\Users\Reymark\Documents\Antigravity-Project\stellar-guardian-3.0
Integrity mode: demo

## Requirements

### R1. Comprehensive Audit & Code Review
Conduct a deep multi-axis audit of the codebase, focusing on Next.js/Supabase architecture, error handling patterns, and performance bottlenecks. Utilize the `code-review-and-quality`, `error-handling`, `nextjs-supabase-auth`, and `performance-optimization` skills.

### R2. Frontend & UX Validation
Evaluate the frontend against premium UI/UX standards, ensuring anti-generic design, robust motion UI, accessibility, and high-end aesthetic cohesion. Utilize the `design-taste-frontend`, `frontend-ui-engineering`, `gpt-taste`, and `ui-ux-pro-max` skills.

### R3. Spec-Driven Implementation Plan
Synthesize all findings into a prioritized spec and implementation plan (`implementation_plan.md`), breaking down actionable tasks needed to bring the project to a production-ready state. Follow `spec-driven-development` guidelines.

## Acceptance Criteria

### Audit Completeness
- [ ] A written audit report is generated detailing architectural, performance, and security issues across the codebase.
- [ ] A written UX/UI evaluation report is generated, explicitly mapping out components that fail to meet high-end aesthetic and accessibility standards.

### Plan Actionability
- [ ] `implementation_plan.md` is created and outlines step-by-step, actionable tasks to resolve every issue found during the audit.
- [ ] An independent auditor subagent (e.g., `security-auditor` or `code-reviewer`) has reviewed the generated plan and confirmed it addresses all identified critical vulnerabilities and architectural flaws.

