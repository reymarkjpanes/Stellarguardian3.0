# Stellar Guardian 3.0 - Team Business Rules

This document centralizes all rules governing the lifecycle, composition, and actions of Teams. These rules must be enforced across the API, Domain Services, and Database Constraints.

## 1. Team State Transitions (The State Machine)
The team `status` dictates what actions are permissible. Transitions are strictly defined.

**Legal Transitions and Conditions:**
- `Draft` -> `Recruiting`
  - **Condition**: Minimum information (profile, tagline) is complete.
- `Recruiting` -> `Ready`
  - **Condition**: The number of Active Members has reached `min_members`.
- `Ready` -> `Locked`
  - **Condition**: A Submission has been officially started OR an Organizer explicitly locks the team OR the event deadline passes.
- `Locked` -> `Archived`
  - **Condition**: The Event itself transitions to archived or closed.

**Illegal Transitions:**
- `Locked` -> `Recruiting` is **NEVER** allowed, unless executed by an Organizer override.

## 2. Team Creation & Roster Limits
- **Creation Eligibility**: Only Participants with an active Event Membership and no existing Team Membership may create a Team.
- **Captaincy**: The creator of a Team is implicitly assigned the `Captain` role.
- **Limits (Database Invariants)**:
  - A Team's membership count must never exceed `teams.max_members`.
  - `max_members` must always be greater than or equal to `min_members`.
  - A user cannot have multiple active Team Memberships within the same Event.

## 3. Join Requests & Invitations
- **Submission**: Users can only submit Join Requests to Teams whose state is `Recruiting` and where the feature flag `allow_public_join` is `true`.
- **Concurrency**: A user cannot have both a pending Invitation and a pending Join Request for the exact same Team to prevent race conditions.
- **Approval Flow**:
  - If `require_captain_approval` is `true`, a Captain must explicitly review and accept the request.
  - If `auto_accept` is `true` (and capacity allows), the request is automatically converted to a membership.
- **Capacity Race Condition**: If multiple requests are accepted simultaneously, the database constraint on `max_members` will reject the transaction that exceeds the limit.

## 4. Captaincy & Transfers
- **Cannot Abandon Ship**: A Captain cannot leave their Team without first transferring ownership to another active Member. This must be executed as an atomic transaction.
- **Rogue Captain Scenario**: A user cannot delete their global platform account if they are the sole Captain of an active Team. They must transfer ownership or disband the Team first.

## 5. State Machine Invariants (Locking)
- **The Lock Down**: Once a Team enters the `Locked` state:
  - All pending Join Requests are automatically `Rejected` or `Withdrawn`.
  - All pending Invitations are automatically `Expired`.
  - Members cannot leave or be removed from the Team.
  - New members cannot be added.

## 6. Deletion & Archiving
- **Deletion**: A Team cannot be deleted if a related `Submission` record exists.
- **Archiving**: A Team cannot be archived if a Judging round involving their Submission has officially started.
- **Slug Uniqueness**: A Team's URL slug must be globally unique within the scope of the `event_id`.

## 7. Activity & Auditing
- **Standardized Logging**: All lifecycle events must generate a `team_activity` record using standardized enum actions (`TEAM_CREATED`, `MEMBER_JOINED`, `JOIN_REQUEST_APPROVED`, etc) along with audit metadata (`source`, `ip_address`, `user_agent`). Arbitrary string actions are prohibited.
