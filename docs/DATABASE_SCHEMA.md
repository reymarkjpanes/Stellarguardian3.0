# Stellar Guardian 3.0 - Database Schema Reference

## Core Hierarchy
- **Global User** (`users`)
- **Workspace Member** (`workspace_members`)
- **Event Member** (`event_members`)
- **Team** (`teams`)
- **Team Member** (`team_memberships`)

## Global Profile
Data that belongs to the user regardless of event or workspace participation is stored globally:
- `users`: Core identity, avatar, bio, timezone, country, city, preferred_language.
- `user_skills`: Intersection of a user and a globally predefined dictionary of skills.
- `user_links`: Links to external portfolios (GitHub, Twitter, Portfolio, etc).
- `user_presence`: Current online status (Online, Away, Offline).
- `wallets`: Crypto wallets tied to the user.

## Memberships
- `workspace_members`: User's membership in a Workspace (Admin, Organizer, Member).
- `event_members`: User's membership in an Event (Participant, Mentor, Judge, Sponsor).
  - Also tracks *Availability* (Available, Busy, Looking for Team, Looking for Mentor).

## Core Application Entities
- `teams`: A group of event members working on a submission.
- `team_memberships`: Ties an `event_member` to a `team`. Role: (Leader, Member).
- `submissions`: A project submitted by a team to an event track.
- `invitations`: Polymorphic invitation tracking. Type: (workspace, event, team, judge_assignment, mentor_assignment). Includes flexible JSONB `payload`.
- `audit_records`: Platform-wide auditing of critical entities.
