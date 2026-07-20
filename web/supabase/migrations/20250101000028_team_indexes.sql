-- Migration: 20250101000028_team_indexes.sql
-- Description: Composite and standard indexes for Module 3.

-- 1. teams
CREATE INDEX IF NOT EXISTS idx_teams_event_status ON public.teams (event_id, status);
CREATE INDEX IF NOT EXISTS idx_teams_event_visibility ON public.teams (event_id, visibility);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON public.teams (slug);

-- 2. team_memberships
CREATE INDEX IF NOT EXISTS idx_team_memberships_member_status ON public.team_memberships (event_member_id, status);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team_id ON public.team_memberships (team_id);

-- 3. team_join_requests
CREATE INDEX IF NOT EXISTS idx_join_requests_team_status ON public.team_join_requests (team_id, status);
CREATE INDEX IF NOT EXISTS idx_join_requests_member ON public.team_join_requests (event_member_id);

-- 4. team_invitations
CREATE INDEX IF NOT EXISTS idx_invitations_team_status ON public.team_invitations (team_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_member ON public.team_invitations (event_member_id);

-- 5. team_roles_needed
CREATE INDEX IF NOT EXISTS idx_roles_needed_team ON public.team_roles_needed (team_id);

-- 6. team_activity
CREATE INDEX IF NOT EXISTS idx_team_activity_timeline ON public.team_activity (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_correlation ON public.team_activity (correlation_id);

-- 7. team_files
CREATE INDEX IF NOT EXISTS idx_team_files_latest ON public.team_files (team_id, is_latest);
