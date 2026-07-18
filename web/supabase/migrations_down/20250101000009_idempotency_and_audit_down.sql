-- Down migration for: 20250101000009_idempotency_and_audit.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop table if exists public.audit_records;
drop table if exists public.idempotency_keys;
