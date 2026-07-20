# Service Contracts (Module 3)

This document serves as the blueprint for all Module 3 Domain Services. It defines the strict boundary interfaces that the API layer can call.

## TeamService

Manages the core lifecycle, settings, and structure of a Team.

- `createTeam(eventId, creatorId, payload)`: Creates team, assigns creator as Captain, emits `TEAM_CREATED`.
- `updateTeam(teamId, payload)`: Updates team metadata, emits `TEAM_UPDATED`.
- `archiveTeam(teamId)`: Soft-deletes the team, emits `TEAM_ARCHIVED`.
- `lockTeam(teamId)`: Locks roster, emits `TEAM_LOCKED`.
- `unlockTeam(teamId)`: Unlocks roster, emits `TEAM_UNLOCKED`.
- `transferCaptain(teamId, fromUserId, toUserId)`: Promotes a new captain, demotes old, emits `CAPTAIN_TRANSFERRED`.
- `inviteMember(teamId, userId, invitedBy)`: Defers to `InvitationService`.
- `removeMember(teamId, userId, removedBy)`: Removes a member (if by Captain) or leaves a team (if self). Emits `TEAM_MEMBER_LEFT`.
- `getTeam(teamId)`: Retrieves the team with its current roster.
- `searchTeams(eventId, filters)`: Retrieves visible teams matching criteria.

## JoinRequestService

Manages the workflow of Users applying to join Teams.

- `createRequest(teamId, userId, message)`: Submits application, emits `JOIN_REQUEST_CREATED`.
- `approveRequest(requestId, approvedBy)`: Upgrades to member, cancels other requests, emits `JOIN_REQUEST_APPROVED` and `TEAM_MEMBER_JOINED`.
- `rejectRequest(requestId, rejectedBy)`: Denies request, emits `JOIN_REQUEST_REJECTED`.
- `withdrawRequest(requestId, userId)`: User cancels their own request.
- `expireRequests()`: CRON job to expire stale pending requests.

## InvitationService

Manages the workflow of Teams inviting Users.

- `sendInvitation(teamId, userId, invitedBy, message)`: Sends invite, emits `INVITATION_SENT`.
- `acceptInvitation(invitationId, userId)`: Upgrades to member, cancels other requests, emits `INVITATION_ACCEPTED` and `TEAM_MEMBER_JOINED`.
- `declineInvitation(invitationId, userId)`: User declines invite, emits `INVITATION_DECLINED`.
- `cancelInvitation(invitationId, cancelledBy)`: Captain revokes invite.
- `expireInvitations()`: CRON job to expire stale pending invitations.

## MatchmakingService

Handles recommendation logic and compatibility scoring.

- `recommendTeams(eventMemberId, filters)`: Suggests teams based on user's profile and team needs.
- `recommendMembers(teamId, filters)`: Suggests available users based on team's preferred roles/skills.
- `calculateCompatibility(eventMemberId, teamId)`: Returns a 0-100 score of how well a user fits a team's needs.
- `calculateCompleteness(eventMemberId)`: Returns 0-100 score of profile completeness (Wallets, GitHub, Bio, Skills).
- `findMissingRoles(teamId)`: Analyzes current roster vs `max_members` to suggest roles.
- `searchBySkills(eventId, skillIds)`: Fast lookup of open teams/users by skills.
