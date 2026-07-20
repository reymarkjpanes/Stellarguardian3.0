-- Migration: 20250101000029_team_membership_rls.sql
-- Description: RLS policies for team_memberships

ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

-- Read: Memberships are readable if the team is readable.
CREATE POLICY "Memberships viewable if team viewable" ON public.team_memberships
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_memberships.team_id)
);

-- Insert/Update/Delete:
-- Since membership changes require business logic (e.g. state machine, max members),
-- direct insertion is restricted to Captains (who can remove members or promote others)
-- OR the member themselves (if they are leaving).
-- The actual Join Request / Invitation approval will be done via SECURITY DEFINER functions in the API
-- to bypass these RLS restrictions for complex workflows.

-- Captains can manage memberships on their team
CREATE POLICY "Captains can manage memberships" ON public.team_memberships
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = team_memberships.team_id 
      AND em.user_id = auth.uid() 
      AND tm.role = 'Captain' 
      AND tm.status = 'Active'
  )
);

-- Users can update their own membership (e.g. to leave)
CREATE POLICY "Users can update their own membership" ON public.team_memberships
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.event_members em 
    WHERE em.id = team_memberships.event_member_id 
      AND em.user_id = auth.uid()
  )
);
