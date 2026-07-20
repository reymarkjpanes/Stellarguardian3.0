-- Migration: 20250101000030_team_views.sql
-- Description: Dynamic metrics and simplified access views for Teams.

-- 1. team_current_captain_view
-- Safely extracts the current active Captain without requiring a join in every query.
CREATE OR REPLACE VIEW public.team_current_captain_view AS
SELECT 
    t.id AS team_id,
    em.user_id AS captain_user_id,
    em.id AS captain_event_member_id
FROM public.teams t
JOIN public.team_memberships tm ON tm.team_id = t.id
JOIN public.event_members em ON em.id = tm.event_member_id
WHERE tm.role = 'Captain' AND tm.status = 'Active';

-- 2. team_metrics_view
-- Replaces denormalized counters with a fast, non-blocking aggregation view.
CREATE OR REPLACE VIEW public.team_metrics_view AS
SELECT 
    t.id AS team_id,
    COUNT(DISTINCT tm.event_member_id) FILTER (WHERE tm.status = 'Active') AS active_members,
    COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'Pending') AS pending_join_requests,
    COUNT(DISTINCT ti.id) FILTER (WHERE ti.status = 'Pending') AS pending_invitations,
    MAX(ta.created_at) AS last_activity_at,
    
    -- Completion score rough heuristic (0-100)
    (
        (CASE WHEN t.logo_url IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN t.banner_url IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN t.tagline IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN t.description IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM public.team_tags tt WHERE tt.team_id = t.id) THEN 20 ELSE 0 END)
    ) AS completion_score,
    
    -- Open roles
    COALESCE(
        (SELECT SUM(quantity) FROM public.team_roles_needed trn WHERE trn.team_id = t.id AND trn.is_filled = false), 
        0
    ) AS open_roles
    
FROM public.teams t
LEFT JOIN public.team_memberships tm ON tm.team_id = t.id
LEFT JOIN public.team_join_requests jr ON jr.team_id = t.id
LEFT JOIN public.team_invitations ti ON ti.team_id = t.id
LEFT JOIN public.team_activity ta ON ta.team_id = t.id
GROUP BY t.id, t.logo_url, t.banner_url, t.tagline, t.description;
