-- Down migration for: 20250101000006_teams_and_submissions.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.
--
-- Drop order: submission_files/submission_versions before submissions;
-- team_members (and its trigger/function) before teams.

drop table if exists public.submission_files;
drop table if exists public.submission_versions;
drop table if exists public.submissions;

drop trigger if exists trg_team_members_set_event_id on public.team_members;
drop table if exists public.team_members;
drop function if exists public.set_team_member_event_id();
drop table if exists public.teams;
