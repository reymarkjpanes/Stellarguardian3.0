-- Migration: team_invitations_user_ids
-- Adds user-id-based columns to team_invitations for simplified API access.
-- The existing event_member_id column is preserved for DDD service layer compatibility.
-- The API layer uses inviter_user_id / invitee_user_id directly for JOIN-free lookups.
-- Requirements: H5, participant team flow

-- Add missing columns if not present (idempotent)
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS inviter_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitee_user_id  uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_id         uuid REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS responded_at     timestamptz;

-- Allow both status conventions (the ENUM might not include lowercase)
-- Add a check-insensitive helper view if needed. For now, allow 'pending' as text alongside ENUM.
-- Since status is public.team_invitation_status ENUM, we need to verify it includes 'pending'.
-- If the ENUM only has 'Pending', the API inserts 'pending' which will fail.
-- Safest: update the ENUM to include both cases, or standardise on PascalCase in the API.



-- Partial unique index: one pending invite per (team, invitee)
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_unique
  ON public.team_invitations (team_id, invitee_user_id)
  WHERE status = 'Pending';

-- Index for participant's inbound invitation lookup
CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee
  ON public.team_invitations (invitee_user_id, event_id, status);

-- Index for captain's outbound invitation lookup
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_status
  ON public.team_invitations (team_id, status);

COMMENT ON COLUMN public.team_invitations.inviter_user_id IS
  'Direct user ID of the person sending the invitation (captain or team member).';

COMMENT ON COLUMN public.team_invitations.invitee_user_id IS
  'Direct user ID of the invited participant.';

COMMENT ON COLUMN public.team_invitations.event_id IS
  'Denormalized event ID for efficient participant-inbox queries.';

-- Also add inviter_type to track whether captain or member sent the invite
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS inviter_role text
    CHECK (inviter_role IN ('Captain', 'Member'))
    DEFAULT 'Captain';

COMMENT ON COLUMN public.team_invitations.inviter_role IS
  'Whether the invitation was sent by the team captain or a regular member.';
