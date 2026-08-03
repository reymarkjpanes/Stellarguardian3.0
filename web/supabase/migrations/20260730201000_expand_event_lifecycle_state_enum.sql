-- Migration: expand_event_lifecycle_state_enum
--
-- Migration 20250101000022 replaced the events.state column with the
-- event_lifecycle_state ENUM, but only added 5 values:
--   Draft, Active, Completed, Cancelled, Archived
--
-- The application state machine uses 18 distinct states. Any attempt to
-- write a state not in the enum (e.g. 'Published') raises:
--   invalid input value for enum event_lifecycle_state: "Published"
--
-- This migration adds the 13 missing values. Postgres allows adding enum
-- values non-destructively via ALTER TYPE ... ADD VALUE. Existing rows
-- are unaffected.
--
-- After this migration the full enum is:
--   Draft, Review, Published, RegistrationOpen, RegistrationClosed,
--   TeamFormationLocked, SubmissionOpen, SubmissionClosed,
--   JudgingRound1, JudgingRound2, WinnerVerification, DisputeWindow,
--   PrizeApproved, EscrowRelease, Completed, Cancelled,
--   Suspended, Archived, Active  (Active kept for backward compat)

ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'Review';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'Published';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'RegistrationOpen';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'RegistrationClosed';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'TeamFormationLocked';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'SubmissionOpen';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'SubmissionClosed';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'JudgingRound1';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'JudgingRound2';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'WinnerVerification';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'DisputeWindow';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'PrizeApproved';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'EscrowRelease';
ALTER TYPE public.event_lifecycle_state ADD VALUE IF NOT EXISTS 'Suspended';
