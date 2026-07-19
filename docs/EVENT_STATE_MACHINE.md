# Event State Machine

The lifecycle of a hackathon/event in Stellar Guardian 3.0 is strictly governed by a 16-state finite state machine (FSM). 

## 1. Core States
The sequential "Happy Path" of an event:

1. **Draft:** Initial creation. Config is mutable.
2. **Published:** Visible to the public. Registration can open.
3. **RegistrationOpen:** Participants can register.
4. **RegistrationClosed:** No more registrations.
5. **TeamFormation:** Participants group into teams.
6. **SubmissionOpen:** Teams can submit projects.
7. **SubmissionClosed:** No more submissions/edits allowed.
8. **Judging:** Judges review and score submissions.
9. **ReviewObjectionWindow:** Scores/rankings are proposed; participants can file disputes.
10. **WinnersFinalized:** Disputes resolved, winners officially selected.
11. **OrganizerFundsEscrow:** Organizer is prompted to sign the Stellar funding transaction.
12. **EscrowLocked:** Funds are secured on-chain.
13. **PrizeDistribution:** Smart contracts/KMS automate payouts to winners.
14. **Completed:** All funds distributed. Event archived.

## 2. Terminal & Exception States
- **Cancelled:** Organizer cancels the event (funds refunded if in Escrow).
- **Archived:** Soft-delete state.

## 3. Transition Rules & Preconditions
Transitions cannot be forced. The `canTransition()` logic ensures prerequisites are met:
- Cannot transition to `Judging` if no submissions exist.
- Cannot transition to `WinnersFinalized` if active disputes exist in the `ReviewObjectionWindow`.
- Cannot transition to `PrizeDistribution` unless escrow balance matches prize pool.

## 4. Architectural Enforcement
In Phase 1, client-side mutations for state changes are eliminated. The API endpoint `PATCH /api/events/[id]/state` is the sole authority for invoking the FSM. It validates the transition, commits the database update transactionally, and emits a `StateChanged` domain event.
