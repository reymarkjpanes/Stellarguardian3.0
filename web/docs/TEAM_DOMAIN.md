# Team Domain

## Aggregate Root: `Team`
The central entity for the Teams bounded context. Enforces invariants around membership size and state transitions.

**Team Aggregate owns:**
- Team lifecycle
- Members (join, leave, remove)
- Invitations
- Join Requests
- Capacity (min/max members)
- Captain transfers
- State transitions (Draft, Recruiting, Ready, Locked)

*(Note: The Submission Aggregate owns files, submission lifecycle, and milestones. The Evaluation Aggregate owns scores, judge assignments, and reviews. These must not be managed by the Team Aggregate.)*

## Policies
- **TeamCapacityPolicy**: Determines if the team can accept more members.
- **CaptainPolicy**: Enforces captain-specific rules (transfer, leave).
- **TeamStatePolicy**: Prevents modifications to locked or archived teams.
