-- Down migration for: 20250101000004_events.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop table if exists public.event_members;
drop table if exists public.events;
