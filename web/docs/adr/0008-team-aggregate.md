# 8. Introduce Aggregate Roots

Date: 2026-07-20

## Status
Accepted

## Context
Business rules and validations were scattered across Domain Services. `TeamService` acted as a "god class" containing all data validation and orchestration logic.

## Decision
We will apply Aggregate Roots from Domain-Driven Design. A `Team` class will encapsulate team-related data (members, max size, status) and expose operations like `acceptJoinRequest()`. The Aggregate Root is the sole guardian of its invariants.

## Consequences
- Business logic is heavily unit-testable without mocking a database.
- Prevents invalid states at the code level before they reach the repository.
