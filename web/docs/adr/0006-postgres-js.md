# 6. Use postgres.js for Server-Side Transactions

Date: 2026-07-20

## Status
Accepted

## Context
Supabase JS client uses PostgREST, which does not support multi-statement interactive transactions. This makes workflows like CreateTeam (insert team, insert captain, insert outbox event) fragile. We need true ACID guarantees.

## Decision
We will use `postgres.js` explicitly for server-side repositories to execute interactive transactions using the connection pool. We will restrict its use to trusted environments (Next.js Node API, background jobs) and keep the Supabase JS client for Auth, Storage, and Realtime.

## Consequences
- Better data integrity for complex workflows.
- Connection pooling requires careful management.
- Hard boundary established: no postgres.js in React components or Edge runtimes.
