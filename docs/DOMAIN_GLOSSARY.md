# Stellar Guardian 3.0 - Domain Glossary

This document defines the ubiquitous language for the platform. These terms are frozen and must be used consistently across the codebase, database, and UI.

## Identity & Profiles
- **User**: The global identity of a person using the platform, regardless of what events they join.
- **Skill**: A standardized tag representing a user's competency (e.g., React, Solidity, UI Design).
- **Wallet**: A cryptographic address owned by a User.
- **Presence**: A user's online state (Online, Away, Offline).

## Hierarchy & Memberships
- **Workspace**: The highest-level organizational container (e.g., a company or hackathon organizer).
- **Workspace Member**: A User who belongs to a Workspace. Has roles: `Admin`, `Organizer`, or `Member`.
- **Event**: A specific competition or hackathon hosted within a Workspace.
- **Event Member**: A User who has joined an Event. Has roles: `Participant`, `Mentor`, `Judge`, `Sponsor`. This layer is the boundary for Event participation.
- **Availability**: The current matching status of an Event Member (e.g., `Available`, `Busy`, `Looking for Team`).

## Teaming & Submissions
- **Team**: A group of Event Members collaborating on a project within an Event.
- **Team Membership**: The junction between an Event Member and a Team. Has roles: `Leader` or `Member`.
- **Submission**: The project artifact submitted by a Team for evaluation.

## Operational Concepts
- **Invitation**: A request sent to a user or email to join a Workspace, Event, or Team, or to accept an assignment (Judge/Mentor). Uses a polymorphic `type` and flexible `payload`.
- **Audit Record**: An immutable log entry of a critical state change within the platform, maintaining a trail for compliance.
- **Escrow**: A smart contract state tracking funds locked for milestones or payouts.
- **Evaluation**: The process of a Judge scoring a Submission based on a defined Rubric.
