# Fix Supabase Migration Sync Issue

The goal is to fix the `Submit failed: Could not find the function public.submit_evaluation...` error properly, by aligning the remote database with the local migration files.

## The Problem

After investigating, the remote database (`zlkqzsgpagupkgnqkapk.supabase.co`) is in a state where it has **partially applied** schemas. It has tables like `users`, `teams`, `disputes`, and `events`, but these tables are **missing columns** that the local codebase expects (e.g., `disputes` is missing `filer_id`, `evaluations` is missing `status`, `teams` is missing `max_members`).

Because the remote database already has these tables (but with an older/different schema), running `npx supabase db push` fails with "relation already exists" or "column does not exist" errors. We cannot just force the push, as it leaves the database broken.

## User Review Required

> [!WARNING]
> We need to decide how to synchronize the database. Please select one of the following options:

### Option A: Database Reset (Recommended for Dev/Test)

If this remote database does not contain critical production data, we can reset it. This will drop the `public` schema and re-run all 55 local migrations from scratch.

- **Pros:** Guarantees a perfectly clean and synchronized database that matches your codebase exactly.
- **Cons:** **All existing data on the remote database will be wiped**.
- **Command:** `npx supabase db reset --linked`

### Option B: Manual Schema Patch (If Data Preservation is Required)

If you have important data on the remote database that cannot be lost, we must manually patch it.

- **Pros:** Preserves existing data.
- **Cons:** Very time-consuming. We will need to pull the remote schema, diff it against the local schema, and manually write a SQL script to add all the missing columns (like `filer_id`, `max_members`, `status`, etc.) before we can push the remaining RPC functions.

## Open Questions

> [!IMPORTANT]
> **Which option would you prefer?**
> If this is a development instance, I highly recommend Option A (`reset`) to ensure the schema is pristine for the judging features we are building.

## Proposed Changes

Depending on your choice, I will either:

1. Run the database reset command and verify the RPCs are deployed successfully.
2. OR, begin the arduous process of diffing and creating a patch migration.

After the database is synced, I will also **revert the temporary codebase fallbacks** I added earlier to `judging.actions.ts` and the UI pages, as the RPCs will now function correctly!
