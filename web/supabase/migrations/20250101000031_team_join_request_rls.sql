-- Migration: 20250101000029_team_join_request_rls.sql
-- Description: RLS policies for team_join_requests and team_invitations

ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Join Requests
-- Read: Captains can read requests for their team. Users can read their own requests.
CREATE POLICY "Captains can view team join requests" ON public.team_join_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = team_join_requests.team_id 
      AND em.user_id = auth.uid() 
      AND tm.role = 'Captain' 
      AND tm.status = 'Active'
  )
);

CREATE POLICY "Users can view their own join requests" ON public.team_join_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_members em 
    WHERE em.id = team_join_requests.event_member_id 
      AND em.user_id = auth.uid()
  )
);

-- Insert: Users can create requests for themselves (if team is recruiting)
CREATE POLICY "Users can create join requests" ON public.team_join_requests
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_members em 
    WHERE em.id = event_member_id 
      AND em.user_id = auth.uid()
  )
);

-- Invitations
-- Read: Captains can read invitations for their team. Users can read their own invitations.
CREATE POLICY "Captains can view team invitations" ON public.team_invitations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = team_invitations.team_id 
      AND em.user_id = auth.uid() 
      AND tm.role = 'Captain' 
      AND tm.status = 'Active'
  )
);

CREATE POLICY "Users can view their own invitations" ON public.team_invitations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_members em 
    WHERE em.id = team_invitations.event_member_id 
      AND em.user_id = auth.uid()
  )
);
