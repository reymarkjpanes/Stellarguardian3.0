-- Migration: 20250101000027_team_constraints.sql
-- Description: Enforce invariants for Module 3 Teams.

-- 1. Check constraints on Teams
ALTER TABLE public.teams 
  ADD CONSTRAINT teams_capacity_check 
  CHECK (max_members >= min_members);

-- 2. Prevent duplicate active team memberships per event_member_id
-- We only want one Active or Pending membership per event. 
-- Wait, the requirement says "A participant belongs to at most one team per event".
-- The previous constraint was on team_members(event_id, user_id).
-- But now event_id is not in team_memberships, it's derived. We'll rely on the existing trigger.
-- First, let's drop the old trigger and recreate it for team_memberships.
DROP TRIGGER IF EXISTS trg_team_members_set_event_id ON public.team_memberships;
DROP FUNCTION IF EXISTS public.set_team_member_event_id();

-- Instead of a trigger for the unique constraint, let's create a partial unique index on event_member_id
-- where status is 'Active'. This natively prevents an event_member from being active on multiple teams.
CREATE UNIQUE INDEX IF NOT EXISTS udx_active_team_membership 
ON public.team_memberships (event_member_id) 
WHERE status = 'Active';

-- 3. Trigger to prevent roster changes if team is Locked or Archived
CREATE OR REPLACE FUNCTION public.check_team_roster_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status public.team_lifecycle_state;
    v_team_id uuid;
BEGIN
    -- Determine team_id based on the operation
    IF TG_OP = 'DELETE' THEN
        v_team_id := OLD.team_id;
    ELSE
        v_team_id := NEW.team_id;
    END IF;

    -- Fetch the team status
    SELECT status INTO v_status FROM public.teams WHERE id = v_team_id;

    IF v_status IN ('Locked', 'Archived') THEN
        RAISE EXCEPTION 'Cannot modify roster of a team in % state', v_status;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Apply to team_memberships
CREATE TRIGGER trg_prevent_locked_roster_changes
BEFORE INSERT OR UPDATE OR DELETE ON public.team_memberships
FOR EACH ROW
EXECUTE FUNCTION public.check_team_roster_lock();

-- 4. Trigger to prevent joining if team is full
-- While API handles workflow, DB can enforce hard invariant on INSERT.
CREATE OR REPLACE FUNCTION public.check_team_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_members int;
    v_current_members int;
BEGIN
    -- Only check if we are making an Active membership
    IF NEW.status != 'Active' THEN
        RETURN NEW;
    END IF;

    SELECT max_members INTO v_max_members FROM public.teams WHERE id = NEW.team_id;
    SELECT COUNT(*) INTO v_current_members FROM public.team_memberships WHERE team_id = NEW.team_id AND status = 'Active';

    -- If this is an update and the old status was already Active, we aren't adding a new member.
    IF TG_OP = 'UPDATE' AND OLD.status = 'Active' THEN
        RETURN NEW;
    END IF;

    IF v_current_members >= v_max_members THEN
        RAISE EXCEPTION 'Team has reached its maximum capacity of % members', v_max_members;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_team_overflow
BEFORE INSERT OR UPDATE ON public.team_memberships
FOR EACH ROW
EXECUTE FUNCTION public.check_team_capacity();
