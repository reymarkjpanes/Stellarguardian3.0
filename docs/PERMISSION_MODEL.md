# Permission Model (Authorization Matrix)

Stellar Guardian enforces authorization using a strict matrix. Every API route must execute this check before interacting with the database.

## Roles
1. **PlatformAdmin:** Global administrator. Can access `/admin`.
2. **WorkspaceAdmin:** Can manage workspace settings, billing, and all events within the workspace.
3. **Organizer:** Can manage specific events, create escrows, and select winners.
4. **Judge:** Can view submissions and submit evaluations.
5. **Mentor:** Can view teams and communicate (Advisory role).
6. **Participant:** Can register, form teams, and submit projects.

## Resource Matrix (Example Mapping)

| Action | Resource | Participant | Judge | Organizer | WorkspaceAdmin |
|---|---|---|---|---|---|
| **Create** | Event | ❌ | ❌ | ✅ | ✅ |
| **Update** | Event Settings | ❌ | ❌ | ✅ | ✅ |
| **Transition**| Event State | ❌ | ❌ | ✅ | ✅ |
| **Fund** | Escrow | ❌ | ❌ | ✅ | ✅ |
| **Join** | Team | ✅ | ❌ | ❌ | ❌ |
| **Create** | Submission | ✅ | ❌ | ❌ | ❌ |
| **Submit** | Evaluation | ❌ | ✅ | ❌ | ❌ |
| **Select** | Winners | ❌ | ❌ | ✅ | ✅ |

## Implementation
- Implemented as a centralized middleware or wrapper function: `requirePermission(user, resource, action)`.
- If the check fails, the API immediately throws a `403 ForbiddenError`.
- Supabase Row-Level Security (RLS) is configured to match these exact rules as a defense-in-depth measure.
