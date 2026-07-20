# Domain Events (Module 3)

This document lists the domain events emitted by the Module 3 Team Services. These events should be written to the `team_activity` table or published to an event bus. Every future system (notifications, realtime updates, analytics, audit logs) should react to these events rather than embedding side effects directly into business logic.

## Team Lifecycle Events
- `TEAM_CREATED`: Emitted when a new team is formed.
- `TEAM_UPDATED`: Emitted when a team's metadata (name, slug, description, etc.) is modified.
- `TEAM_ARCHIVED`: Emitted when a team is soft-deleted or archived.
- `TEAM_LOCKED`: Emitted when a team's roster is locked by the captain.
- `TEAM_UNLOCKED`: Emitted when a team's roster is unlocked.

## Membership & Roster Events
- `TEAM_MEMBER_JOINED`: Emitted when a user joins the team (either via accepted request or accepted invitation).
- `TEAM_MEMBER_LEFT`: Emitted when a member is removed by the captain or leaves voluntarily.
- `CAPTAIN_TRANSFERRED`: Emitted when captaincy is transferred to a new member.

## Join Request Events (User -> Team)
- `JOIN_REQUEST_CREATED`: Emitted when a user applies to join a team.
- `JOIN_REQUEST_APPROVED`: Emitted when the captain approves a join request.
- `JOIN_REQUEST_REJECTED`: Emitted when the captain denies a join request.

## Invitation Events (Team -> User)
- `INVITATION_SENT`: Emitted when the captain sends an invitation to a user.
- `INVITATION_ACCEPTED`: Emitted when the user accepts the team's invitation.
- `INVITATION_DECLINED`: Emitted when the user declines the team's invitation.

## Collaboration Events
- `FILE_UPLOADED`: Emitted when a file is added to the team workspace.
- `FILE_READY`: Emitted when a file has successfully completed scanning.
- `FILE_DELETED`: Emitted when a file is removed.
- `SETTINGS_UPDATED`: Emitted when team settings (like join policies) are changed.
