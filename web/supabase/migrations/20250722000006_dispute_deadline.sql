-- Migration: dispute_deadline
-- Adds auto-dismiss deadline to disputes (M8).
-- Open disputes past deadline are auto-dismissed by cron.
-- Requirements: M8 (dispute blocks indefinitely), Req 39

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS deadline timestamptz;

-- Default deadline: event's review_window_hours from dispute creation
-- (set by the dispute service when creating a dispute)

COMMENT ON COLUMN public.disputes.deadline IS
  'Auto-dismiss deadline. If dispute is still Open after this time, cron auto-dismisses it.';

-- Prize split policy for team events (H5)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS prize_split_policy text
    NOT NULL DEFAULT 'captain_receives'
    CHECK (prize_split_policy IN ('captain_receives', 'equal_split', 'custom'));

COMMENT ON COLUMN public.events.prize_split_policy IS
  'How team prizes are split: captain_receives (default), equal_split, or custom allocation.';
