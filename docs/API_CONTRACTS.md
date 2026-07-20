# Stellar Guardian 3.0 - API Contracts

All APIs return standardized JSON responses using the `Envelope<T>` pattern.

## Envelope Structure

```typescript
type Envelope<T> = {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    cursor?: string | null;
    hasMore?: boolean;
    page?: number;
    limit?: number;
  };
};
```

## Key API Endpoints

### Users
- `GET /api/users/me`: Returns the global user profile for the authenticated session.
- `PATCH /api/users/me`: Updates global profile fields (bio, timezone, etc).

### Memberships
- `GET /api/workspaces/[id]/members`: Cursor-paginated list of workspace members.
- `GET /api/events/[id]/members`: Cursor-paginated list of event members. Returns calculated `profileMissing` fields based on global user data.

### Invitations
- `POST /api/invitations`: Creates an invitation. Requires `type` (workspace, event, team, judge_assignment, mentor_assignment), `targetId`, `inviteeEmail`.
- `GET /api/invitations`: List pending invitations for the current user.
- `POST /api/invitations/[id]/accept`: Accepts an invitation, transitioning state and creating necessary membership records via RPC.
- `POST /api/invitations/[id]/decline`: Declines an invitation.

### Teams & Submissions
- `POST /api/teams`: Creates a new team and assigns the creator as Leader.
- `POST /api/teams/[id]/submissions`: Submits the project for the given team.

## Error Codes
- `UNAUTHORIZED`: Session is missing or invalid.
- `FORBIDDEN`: User lacks permissions (e.g., trying to modify a team they do not lead).
- `NOT_FOUND`: Resource does not exist.
- `VALIDATION_ERROR`: Request payload fails Zod schema validation.
- `CONFLICT`: Resource state prevents action (e.g., team already submitted).
- `INTERNAL_SERVER_ERROR`: Unhandled exception or database error.
