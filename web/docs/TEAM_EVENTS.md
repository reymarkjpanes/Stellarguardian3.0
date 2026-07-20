# Team Domain Events

## Internal Events
Events emitted by the Team aggregate, consumed within the same bounded context.
Convention: Immutable, past tense, domain language (never UI terminology).

- `TeamCreated`
- `TeamArchived`
- `TeamLocked`
- `CaptainTransferred`
- `JoinRequestCreated`
- `JoinRequestApproved`
- `JoinRequestRejected`
- `InvitationSent`
- `InvitationAccepted`
- `InvitationDeclined`

## External Events
Events designed to be consumed by other modules (Realtime, Notifications, Analytics).
- `NotificationRequested`
- `AuditLogRequested`
