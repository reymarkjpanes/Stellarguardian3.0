-- Down migration for: 20250101000003_workspaces.sql
-- Local development only — see supabase/migrations/README.md.
-- Not applied automatically by the Supabase CLI.

drop table if exists public.workspace_members;
drop table if exists public.workspaces;
