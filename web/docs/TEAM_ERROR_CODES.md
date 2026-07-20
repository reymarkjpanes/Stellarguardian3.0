# Team Error Codes

All API errors return a standard JSON format mapped from `DomainError`.

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid payload format. |
| `NOT_FOUND` | 404 | Team or request not found. |
| `CAPACITY_EXCEEDED` | 409 | Team is full. |
| `BUSINESS_RULE_VIOLATION`| 422 | E.g., Only captain can perform this. |
| `STATE_TRANSITION_ERROR` | 422 | E.g., Cannot modify a Locked team. |
| `DUPLICATE_REQUEST` | 409 | Idempotency lock or identical state. |
