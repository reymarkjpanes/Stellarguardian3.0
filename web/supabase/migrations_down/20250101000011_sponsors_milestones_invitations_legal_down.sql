-- Down migration for: 20250101000011_sponsors_milestones_invitations_legal.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop table if exists public.legal_acceptances;
drop table if exists public.invitations;
drop table if exists public.milestones;
drop table if exists public.sponsors;
