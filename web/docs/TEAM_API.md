# Team API Contracts

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
