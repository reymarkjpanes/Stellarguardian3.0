import os

docs = {
    "docs/TEAM_API.md": """# Team API Contracts

## Endpoints

### POST `/api/events/:id/teams`
**Requires:** `Participant`
**Description:** Creates a new team and assigns the creator as the Captain.

### GET `/api/events/:id/teams/:teamId`
**Requires:** `Public`
**Description:** Retrieves team details and public metrics.

### PATCH `/api/events/:id/teams/:teamId`
**Requires:** `Captain`
**Description:** Updates team details, status, or visibility.
""",
    "docs/TEAM_DOMAIN.md": """# Team Domain

## Aggregate Root: `Team`
The central entity for the Teams bounded context. Enforces invariants around membership size and state transitions.

## Policies
- **TeamCapacityPolicy**: Determines if the team can accept more members.
- **CaptainPolicy**: Enforces captain-specific rules (transfer, leave).
- **TeamStatePolicy**: Prevents modifications to locked or archived teams.
""",
    "docs/TEAM_SEQUENCE_DIAGRAMS.md": """# Team Sequence Diagrams

## Create Team

```mermaid
sequenceDiagram
    actor User
    participant API as CreateTeamRoute
    participant App as CreateTeamUseCase
    participant Repo as PostgresTeamRepository
    participant Event as EventPublisher
    participant DB as Postgres

    User->>API: POST /teams
    API->>App: execute(Command, RequestContext)
    App->>DB: BEGIN Transaction
    App->>Repo: create(team)
    Repo->>DB: INSERT INTO teams
    App->>Repo: addMember(captain)
    Repo->>DB: INSERT INTO team_memberships
    App->>Event: publish(TeamCreated)
    Event->>DB: INSERT INTO outbox_events
    App->>DB: COMMIT Transaction
    App-->>API: teamId
    API-->>User: 200 OK
```
""",
    "docs/TEAM_ERROR_CODES.md": """# Team Error Codes

All API errors return a standard JSON format mapped from `DomainError`.

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid payload format. |
| `NOT_FOUND` | 404 | Team or request not found. |
| `CAPACITY_EXCEEDED` | 409 | Team is full. |
| `BUSINESS_RULE_VIOLATION`| 422 | E.g., Only captain can perform this. |
| `STATE_TRANSITION_ERROR` | 422 | E.g., Cannot modify a Locked team. |
| `DUPLICATE_REQUEST` | 409 | Idempotency lock or identical state. |
""",
    "docs/TEAM_EVENTS.md": """# Team Domain Events

## Internal Events
Events emitted by the Team aggregate, consumed within the same bounded context.
- `TeamCreated`
- `TeamMemberJoined`
- `TeamMemberLeft`
- `CaptainTransferred`

## External Events
Events designed to be consumed by other modules (Realtime, Notifications, Analytics).
- `NotificationRequested`
- `AuditLogRequested`
""",
    "docs/TEAM_RBAC.md": """# Team RBAC

| Action | Organizer | Captain | Member | Participant | Public |
|---|---|---|---|---|---|
| Create Team | - | - | - | Yes | - |
| Edit Team | Yes | Yes | - | - | - |
| Delete/Archive | Yes | Yes | - | - | - |
| Lock/Unlock | Yes | Yes | - | - | - |
| View Members | Yes | Yes | Yes | Yes | Yes |
"""
}

for path, content in docs.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

print("Docs created.")
