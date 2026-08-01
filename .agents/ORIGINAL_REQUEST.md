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
