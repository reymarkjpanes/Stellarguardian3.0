# Domain Model

Stellar Guardian 3.0 follows Domain-Driven Design (DDD). Business logic is encapsulated in Aggregates and Bounded Contexts.

## Bounded Contexts

### 1. Workspace Context
The root of multi-tenancy. Every event and user role is scoped to a workspace.
- **Aggregates:** `Workspace`, `WorkspaceMember`
- **Rules:** A user can be an Admin or Member. All resources underneath belong to the Workspace.

### 2. Event Context
The core entity representing a hackathon or bounty.
- **Aggregates:** `Event`, `Milestone`, `Sponsor`
- **Rules:** 
  - Events traverse a strict 16-state lifecycle (see `EVENT_STATE_MACHINE.md`).
  - Events have configurable rubrics and team size limits.

### 3. Team Context
Manages participant groupings.
- **Aggregates:** `Team`, `TeamMember`, `JoinRequest`
- **Rules:** 
  - A participant can only belong to one team per event.
  - Team size must not exceed the event's `team_size_max`.

### 4. Submission & Evaluation Context
Handles project submissions and judge scoring.
- **Aggregates:** `Submission`, `SubmissionVersion`, `Evaluation`, `Dispute`
- **Rules:**
  - Submissions can only be created when Event is in `SubmissionOpen`.
  - Judges cannot evaluate their own teams (Conflict of Interest).
  - Disputes can only be filed during the `ReviewObjectionWindow`.

### 5. Escrow & Distribution Context
Handles financial logic and Stellar integration.
- **Aggregates:** `EscrowAccount`, `EscrowTransaction`, `Winner`
- **Rules:**
  - Escrow can only be funded when Event is in `OrganizerFundsEscrow`.
  - Disbursements can only occur when Event is in `PrizeDistribution`.

## Domain Services
When logic spans multiple aggregates (e.g., determining if all teams have been evaluated before advancing the event state), it is handled by a Domain Service, keeping the aggregates focused and pure.
