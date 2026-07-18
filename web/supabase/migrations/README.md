# Database migrations

## Convention

Files in this directory follow the standard Supabase CLI convention:
`<YYYYMMDDHHMMSS>_<description>.sql`, one migration per logical group of
tables (Req 2.4). They are applied in filename (timestamp) order by
`supabase migration up` / `supabase db reset` / `supabase db push`.

## Why there are no paired `_down.sql` files in this directory

The Supabase CLI is **forward-only by design**: `supabase migration new`
generates a single empty `.sql` file, and there is no CLI convention or flag
that pairs an "up" file with a "down" file that gets auto-invoked. Confirmed
via the CLI's own command reference (`supabase migration --help` /
[CLI docs](https://github.com/supabase/cli/blob/develop/apps/cli/docs/go-cli-reference.md)):

- `supabase migration new <name>` — creates one empty forward migration file.
- `supabase migration up` — applies pending forward migration files in order.
- `supabase migration down [--last N]` — rolls back locally by **dropping all
  user schemas and replaying migration history from scratch** (via
  `supabase db reset` semantics), not by running a per-file reverse script.

Because of this, if a companion `<timestamp>_<name>_down.sql` file were placed
directly in `supabase/migrations/`, the CLI would treat it as **another
forward migration** and try to apply it — it has no special handling for a
`_down` suffix. Naming a rollback script so it matches the migration glob
pattern inside this directory is actively dangerous.

## Chosen convention: companion rollback scripts in `supabase/migrations_down/`

To still give this project explicit, reviewable "down" support (Req 2.4) for
local development without confusing the CLI, each forward migration file in
`supabase/migrations/<timestamp>_<name>.sql` has a companion rollback script
at `supabase/migrations_down/<timestamp>_<name>_down.sql`, living in a
directory the Supabase CLI never scans.

Rules for these companion scripts:

1. **Local development only.** They are never applied automatically by the
   CLI, by `supabase db reset`, or in any deployed environment.
2. **Manual invocation only**, against the local dev database, e.g.:
   ```sh
   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
     -f supabase/migrations_down/20250101000011_sponsors_milestones_invitations_legal_down.sql
   ```
3. **Apply in strict reverse-timestamp order** relative to whichever forward
   migrations you want to undo, since later migrations may reference tables
   created by earlier ones (foreign keys).
4. For a full local reset instead of a surgical rollback, prefer the native
   `supabase migration down --last N` (or `supabase db reset`), which
   reliably replays the entire migration history and reseeds — the companion
   scripts exist only for the case where you want to undo a single
   in-progress migration you're iterating on without nuking the whole local
   database.
5. Companion scripts are best-effort: they drop the tables/indexes/functions
   introduced by their forward counterpart. They do not attempt to restore
   any data that existed in those tables.

## Ordering and dependencies

Migrations are ordered so that every foreign key references a table created
in the same or an earlier migration:

1. `extensions` — `pgcrypto` (for `gen_random_uuid()`)
2. `users_and_wallets` — `users`, `wallets`, `wallet_challenges`
3. `workspaces` — `workspaces`, `workspace_members`
4. `events` — `events`, `event_members`
5. `escrow_and_transactions` — `escrow_accounts`, `transactions`
6. `teams_and_submissions` — `teams`, `team_members`, `submissions`,
   `submission_versions`, `submission_files`
7. `evaluations_and_winners` — `evaluations`, `winners`
8. `disputes` — `disputes`, `dispute_evidence`
9. `idempotency_and_audit` — `idempotency_keys`, `audit_records`
10. `notifications` — `notifications`, `notification_preferences`
11. `sponsors_milestones_invitations_legal` — `sponsors`, `milestones`,
    `invitations`, `legal_acceptances`

RLS policies, append-only enforcement on `audit_records`, and the
`supabase_realtime` publication additions are deliberately **not** part of
these migrations — they are added in a dedicated follow-up migration (task
3.3) so that schema shape and access-control policy changes are reviewable
independently.

## Verification note

No local Postgres/Docker daemon was available in the environment these
migrations were authored in, so they were not run through
`supabase db reset` / `supabase migration up` against a live database. They
were instead verified by:

- Manual syntax review of every `CREATE TABLE`, `CREATE INDEX`,
  `CREATE TRIGGER`, and `CREATE FUNCTION` statement.
- Confirming table creation order respects every foreign key dependency
  (listed above — no migration references a table defined in a later file).
- Cross-checking every column, `CHECK` constraint, and enum against the Zod
  schemas in `/types` (the single source of truth per Req 1.5) to ensure the
  database mirrors them exactly.

Before deploying, run `supabase db reset` (or `supabase migration up` against
a fresh local database) once Docker/local Postgres is available, to confirm
the migrations apply cleanly end to end.
