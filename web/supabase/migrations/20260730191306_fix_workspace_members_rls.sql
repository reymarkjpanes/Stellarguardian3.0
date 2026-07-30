-- Migration: fix_workspace_members_rls
-- Resolves the infinite recursion bug on workspace_members_select and refreshes schema cache

CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;

CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT public.get_my_workspaces())
  );

-- Reload PostgREST schema cache to resolve missing RPC issues
NOTIFY pgrst, 'reload schema';
