-- Migration: align_state_machines
-- Drops the old CHECK constraints and introduces extensible ENUMs for state tracking.

-- 1. Create Types
CREATE TYPE public.event_lifecycle_state AS ENUM ('Draft', 'Active', 'Completed', 'Cancelled', 'Archived');
CREATE TYPE public.event_phase_state AS ENUM ('Setup', 'Registration', 'Team Building', 'Submission', 'Judging', 'Completed');
CREATE TYPE public.visibility_state AS ENUM ('Private', 'Workspace', 'Public');
CREATE TYPE public.team_status_state AS ENUM ('Recruiting', 'Ready', 'Locked', 'Disbanded');
CREATE TYPE public.member_team_status AS ENUM ('No Team', 'In Team');
CREATE TYPE public.invitation_state AS ENUM ('Pending', 'Accepted', 'Declined', 'Cancelled', 'Expired');
CREATE TYPE public.submission_lifecycle_state AS ENUM ('Not Started', 'Draft', 'Submitted', 'Locked', 'Under Review', 'Evaluated');
CREATE TYPE public.evaluation_lifecycle_state AS ENUM ('Assigned', 'Draft', 'Submitted', 'Flagged', 'Finalized');

-- 2. Refactor RLS Policies to use visibility (Must be done before dropping state column)
-- Drop old policies
DROP POLICY IF EXISTS "events_select_public" ON public.events;
DROP POLICY IF EXISTS "event_members_select" ON public.event_members;
DROP POLICY IF EXISTS "teams_select" ON public.teams;
DROP POLICY IF EXISTS "team_members_select" ON public.team_members;
DROP POLICY IF EXISTS "sponsors_select" ON public.sponsors;
DROP POLICY IF EXISTS "milestones_select" ON public.milestones;
DROP POLICY IF EXISTS "submissions_select_visible" ON public.submissions;
DROP POLICY IF EXISTS "submission_versions_select" ON public.submission_versions;
DROP POLICY IF EXISTS "submission_files_select" ON public.submission_files;

-- 3. Alter events table
ALTER TABLE public.events ADD COLUMN visibility public.visibility_state not null default 'Private';
ALTER TABLE public.events ADD COLUMN phase public.event_phase_state not null default 'Setup';

-- Add temporary column for new state to handle the mapping
ALTER TABLE public.events ADD COLUMN new_state public.event_lifecycle_state;

-- Map data
UPDATE public.events SET
  new_state = CASE
    WHEN state IN ('Draft', 'Review', 'Suspended') THEN 'Draft'::public.event_lifecycle_state
    WHEN state IN ('PrizeApproved', 'EscrowRelease', 'Completed') THEN 'Completed'::public.event_lifecycle_state
    WHEN state = 'Cancelled' THEN 'Cancelled'::public.event_lifecycle_state
    WHEN state = 'Archived' THEN 'Archived'::public.event_lifecycle_state
    ELSE 'Active'::public.event_lifecycle_state
  END,
  visibility = CASE
    WHEN state IN ('Draft', 'Review', 'Suspended', 'Cancelled', 'Archived') THEN 'Private'::public.visibility_state
    ELSE 'Public'::public.visibility_state
  END,
  phase = CASE
    WHEN state IN ('Draft', 'Review', 'Suspended') THEN 'Setup'::public.event_phase_state
    WHEN state IN ('Published', 'RegistrationOpen') THEN 'Registration'::public.event_phase_state
    WHEN state = 'RegistrationClosed' THEN 'Team Building'::public.event_phase_state
    WHEN state IN ('TeamFormationLocked', 'SubmissionOpen') THEN 'Submission'::public.event_phase_state
    WHEN state IN ('SubmissionClosed', 'JudgingRound1', 'JudgingRound2') THEN 'Judging'::public.event_phase_state
    WHEN state IN ('WinnerVerification', 'DisputeWindow', 'PrizeApproved', 'EscrowRelease', 'Completed', 'Cancelled', 'Archived') THEN 'Completed'::public.event_phase_state
    ELSE 'Setup'::public.event_phase_state
  END;

-- Drop old check constraint
ALTER TABLE public.events ALTER COLUMN state DROP DEFAULT;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_state_check;

-- Swap columns
ALTER TABLE public.events DROP COLUMN state;
ALTER TABLE public.events RENAME COLUMN new_state TO state;
ALTER TABLE public.events ALTER COLUMN state SET NOT NULL;
ALTER TABLE public.events ALTER COLUMN state SET DEFAULT 'Draft'::public.event_lifecycle_state;

-- 4. Recreate RLS Policies
CREATE POLICY "events_select_public" ON public.events
  FOR SELECT USING (
    visibility = 'Public'
    OR organizer_id = (select auth.uid())
    OR exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = events.workspace_id
        and wm.user_id = (select auth.uid())
    )
  );

CREATE POLICY "event_members_select" ON public.event_members
  FOR SELECT USING (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.visibility = 'Public'
        or e.organizer_id = (select auth.uid())
      )
    )
    or exists (
      select 1 from public.events e
      join public.workspace_members wm on wm.workspace_id = e.workspace_id
      where e.id = event_id and wm.user_id = (select auth.uid())
    )
  );

CREATE POLICY "teams_select" ON public.teams
  FOR SELECT USING (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.visibility = 'Public'
        or e.organizer_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "team_members_select" ON public.team_members
  FOR SELECT USING (
    exists (
      select 1 from public.teams t
      join public.events e on e.id = t.event_id
      where t.id = team_id and e.visibility = 'Public'
    )
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      join public.events e on e.id = t.event_id
      where t.id = team_id and e.organizer_id = (select auth.uid())
    )
  );

CREATE POLICY "sponsors_select" ON public.sponsors
  FOR SELECT USING (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.visibility = 'Public'
    )
    or exists (
      select 1 from public.events e
      join public.workspace_members wm on wm.workspace_id = e.workspace_id
      where e.id = event_id and wm.user_id = (select auth.uid())
    )
  );

CREATE POLICY "milestones_select" ON public.milestones
  FOR SELECT USING (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.visibility = 'Public'
    )
    or exists (
      select 1 from public.events e
      join public.workspace_members wm on wm.workspace_id = e.workspace_id
      where e.id = event_id and wm.user_id = (select auth.uid())
    )
  );

-- 5. Alter event_members
ALTER TABLE public.event_members ADD COLUMN team_status public.member_team_status not null default 'No Team';
ALTER TABLE public.event_members ADD COLUMN mentor_request boolean not null default false;

-- 6. Alter teams
ALTER TABLE public.teams ADD COLUMN status public.team_status_state not null default 'Recruiting';

-- 7. Alter submissions
ALTER TABLE public.submissions ADD COLUMN new_status public.submission_lifecycle_state;

UPDATE public.submissions SET
  new_status = CASE
    WHEN status = 'Submitted' THEN 'Submitted'::public.submission_lifecycle_state
    ELSE 'Draft'::public.submission_lifecycle_state
  END;

ALTER TABLE public.submissions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;

ALTER TABLE public.submissions DROP COLUMN status;
ALTER TABLE public.submissions RENAME COLUMN new_status TO status;
ALTER TABLE public.submissions ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.submissions ALTER COLUMN status SET DEFAULT 'Draft'::public.submission_lifecycle_state;

-- 8. Alter evaluations
ALTER TABLE public.evaluations ADD COLUMN status public.evaluation_lifecycle_state not null default 'Assigned';
ALTER TABLE public.evaluations ADD COLUMN draft_notes text;

-- 9. Alter invitations
ALTER TABLE public.invitations ADD COLUMN status public.invitation_state not null default 'Pending';

UPDATE public.invitations SET
  status = CASE
    WHEN accepted_at IS NOT NULL THEN 'Accepted'::public.invitation_state
    WHEN expires_at < now() THEN 'Expired'::public.invitation_state
    ELSE 'Pending'::public.invitation_state
  END;

-- 10. Recreate Submission Policies
CREATE POLICY "submissions_select_visible" ON public.submissions
  FOR SELECT USING (
    status = 'Submitted'
    or submitter_id = (select auth.uid())
    or exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where t.id = submissions.team_id and tm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organizer_id = (select auth.uid())
    )
  );

CREATE POLICY "submission_versions_select" ON public.submission_versions
  FOR SELECT USING (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id and (
        s.submitter_id = (select auth.uid())
        or s.status = 'Submitted'
      )
    )
  );

CREATE POLICY "submission_files_select" ON public.submission_files
  FOR SELECT USING (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id and (
        s.submitter_id = (select auth.uid())
        or s.status = 'Submitted'
      )
    )
  );

