-- Migration: organizer_self_assign_judge_rpc
--
-- Adds a SECURITY DEFINER RPC that lets an event organizer add themselves
-- as a Judge without being blocked by the event_members RLS INSERT/SELECT
-- policies. RLS policies on event_members do not cover the case where the
-- organizer inserts a second row for themselves under a different role;
-- the RETURNING check against the SELECT policy can fail depending on
-- visibility state. Running as the table owner bypasses that entirely.
--
-- Security:
--   • Auth check: rejects unauthenticated callers.
--   • Authorization: verifies the caller holds an 'Organizer' row for
--     the target event before inserting. Non-organizers get a clean error.
--   • Idempotent: ON CONFLICT DO NOTHING means calling it twice is safe.

CREATE OR REPLACE FUNCTION public.organizer_self_assign_judge(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_organizer boolean;
BEGIN
  -- 1. Require authentication.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- 2. Verify the caller is an Organizer of this event.
  SELECT EXISTS (
    SELECT 1
    FROM public.event_members
    WHERE event_id = p_event_id
      AND user_id  = v_user_id
      AND role     = 'Organizer'
  ) INTO v_is_organizer;

  IF NOT v_is_organizer THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only event organizers can self-assign as judge.');
  END IF;

  -- 3. Insert the Judge row. ON CONFLICT DO NOTHING makes it idempotent:
  --    if the organizer is already a Judge nothing happens and we still
  --    return success.
  INSERT INTO public.event_members (event_id, user_id, role, availability)
  VALUES (p_event_id, v_user_id, 'Judge', 'Available')
  ON CONFLICT (event_id, user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users only.
REVOKE ALL ON FUNCTION public.organizer_self_assign_judge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_self_assign_judge(uuid) TO authenticated;
