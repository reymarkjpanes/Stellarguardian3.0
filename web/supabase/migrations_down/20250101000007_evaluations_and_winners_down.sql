-- Down migration for: 20250101000007_evaluations_and_winners.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop table if exists public.evaluations;
drop table if exists public.winners;
