-- Migration: 20250101000029_team_rls.sql
-- Description: RLS policies for core teams, roles_needed, and links.

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles_needed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_preferences ENABLE ROW LEVEL SECURITY;

-- TEAMS
-- Read: Public can view Public teams. Workspace members can view Workspace teams. Invited/Members can view Private teams.
CREATE POLICY "Public teams are viewable by everyone" ON public.teams
FOR SELECT USING (visibility = 'Public' AND status != 'Draft');

CREATE POLICY "Workspace teams viewable by event members" ON public.teams
FOR SELECT USING (
  visibility = 'Workspace' 
  AND EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = teams.event_id AND em.user_id = auth.uid())
);

CREATE POLICY "Private teams viewable by members" ON public.teams
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = teams.id AND em.user_id = auth.uid()
  )
);

-- Insert: Any event member can create a team.
CREATE POLICY "Event members can create teams" ON public.teams
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_id AND em.user_id = auth.uid())
);

-- Update: Captains can update teams.
CREATE POLICY "Captains can update teams" ON public.teams
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = teams.id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'
  )
);

-- Delete/Archive: Captains only. (Note: Business logic restricts deletion if submission exists, but DB RLS also restricts to Captain).
CREATE POLICY "Captains can delete teams" ON public.teams
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = teams.id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'
  )
);

-- Sub-tables follow the same pattern: readable if team is readable, editable by captain.
-- Settings, Roles, Links, Tags, Match Prefs

CREATE POLICY "Sub-tables viewable if team is viewable" ON public.team_settings
FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_settings.team_id));

CREATE POLICY "Captains can manage sub-tables" ON public.team_settings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = team_settings.team_id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'
  )
);

-- Apply identical generic policies for other sub-tables (simplifying for the seed)
CREATE POLICY "Sub-tables viewable if team is viewable" ON public.team_roles_needed FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_id));
CREATE POLICY "Captains can manage sub-tables" ON public.team_roles_needed FOR ALL USING (EXISTS (SELECT 1 FROM public.team_memberships tm JOIN public.event_members em ON em.id = tm.event_member_id WHERE tm.team_id = team_roles_needed.team_id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'));

CREATE POLICY "Sub-tables viewable if team is viewable" ON public.team_links FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_id));
CREATE POLICY "Captains can manage sub-tables" ON public.team_links FOR ALL USING (EXISTS (SELECT 1 FROM public.team_memberships tm JOIN public.event_members em ON em.id = tm.event_member_id WHERE tm.team_id = team_links.team_id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'));

CREATE POLICY "Sub-tables viewable if team is viewable" ON public.team_feature_flags FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_id));
CREATE POLICY "Captains can manage sub-tables" ON public.team_feature_flags FOR ALL USING (EXISTS (SELECT 1 FROM public.team_memberships tm JOIN public.event_members em ON em.id = tm.event_member_id WHERE tm.team_id = team_feature_flags.team_id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'));

CREATE POLICY "Sub-tables viewable if team is viewable" ON public.team_tags FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_id));
CREATE POLICY "Captains can manage sub-tables" ON public.team_tags FOR ALL USING (EXISTS (SELECT 1 FROM public.team_memberships tm JOIN public.event_members em ON em.id = tm.event_member_id WHERE tm.team_id = team_tags.team_id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'));

CREATE POLICY "Sub-tables viewable if team is viewable" ON public.team_match_preferences FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_id));
CREATE POLICY "Captains can manage sub-tables" ON public.team_match_preferences FOR ALL USING (EXISTS (SELECT 1 FROM public.team_memberships tm JOIN public.event_members em ON em.id = tm.event_member_id WHERE tm.team_id = team_match_preferences.team_id AND em.user_id = auth.uid() AND tm.role = 'Captain' AND tm.status = 'Active'));

-- Tags Dictionary
CREATE POLICY "Tags are public" ON public.tags FOR SELECT USING (true);
