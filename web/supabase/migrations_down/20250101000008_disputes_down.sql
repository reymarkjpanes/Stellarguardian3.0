-- Down migration for: 20250101000008_disputes.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop table if exists public.dispute_evidence;
drop table if exists public.disputes;
