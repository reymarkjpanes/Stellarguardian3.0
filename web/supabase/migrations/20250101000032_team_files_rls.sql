-- Migration: 20250101000029_team_files_rls.sql
-- Description: RLS policies for team_files

ALTER TABLE public.team_files ENABLE ROW LEVEL SECURITY;

-- Read: Depends on visibility (Workspace = all event members, Private = team members)
CREATE POLICY "Team files viewable based on visibility" ON public.team_files
FOR SELECT USING (
  (
    visibility = 'Workspace' 
    AND EXISTS (
      SELECT 1 FROM public.teams t 
      JOIN public.event_members em ON em.event_id = t.event_id 
      WHERE t.id = team_files.team_id AND em.user_id = auth.uid()
    )
  )
  OR
  (
    visibility = 'Private'
    AND EXISTS (
      SELECT 1 FROM public.team_memberships tm 
      JOIN public.event_members em ON em.id = tm.event_member_id
      WHERE tm.team_id = team_files.team_id AND em.user_id = auth.uid() AND tm.status = 'Active'
    )
  )
);

-- Insert/Update: Any active team member can upload files, unless restricted by settings (which API will handle).
CREATE POLICY "Active members can upload team files" ON public.team_files
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = team_id AND em.user_id = auth.uid() AND tm.status = 'Active'
  )
);

CREATE POLICY "Active members can manage their own files" ON public.team_files
FOR UPDATE USING (
  uploaded_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.team_memberships tm 
    JOIN public.event_members em ON em.id = tm.event_member_id
    WHERE tm.team_id = team_id AND em.user_id = auth.uid() AND tm.status = 'Active'
  )
);
