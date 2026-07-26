-- Migration: Update create_event_with_member RPC to persist prize_split_policy
--
-- prize_split_policy was added to public.events in 20250722000006_dispute_deadline.sql
-- but the RPC INSERT was not updated to include it. This migration fixes the gap so
-- the column is populated atomically on event creation instead of relying on the
-- column default ('captain_receives') every time.

CREATE OR REPLACE FUNCTION public.create_event_with_member(event_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as elevated privileges for transactional boundary; business-logic auth enforced before invocation
AS $$
DECLARE
  new_event_id uuid;
  new_event jsonb;
BEGIN
  -- Insert into events table (includes prize_split_policy column added in 20250722000006)
  INSERT INTO public.events (
    workspace_id,
    organizer_id,
    title,
    description,
    category,
    format,
    tags,
    team_size_min,
    team_size_max,
    registration_deadline,
    prize_pool_target,
    network_mode,
    review_window_hours,
    prize_split_policy,
    resubmission_policy,
    file_policy,
    state
  ) VALUES (
    (event_payload->>'workspace_id')::uuid,
    (event_payload->>'organizer_id')::uuid,
    event_payload->>'title',
    event_payload->>'description',
    event_payload->>'category',
    event_payload->>'format',
    ARRAY(SELECT jsonb_array_elements_text(event_payload->'tags')),
    (event_payload->>'team_size_min')::int,
    (event_payload->>'team_size_max')::int,
    (event_payload->>'registration_deadline')::timestamptz,
    (event_payload->>'prize_pool_target')::numeric,
    event_payload->>'network_mode',
    (event_payload->>'review_window_hours')::int,
    COALESCE(event_payload->>'prize_split_policy', 'captain_receives'),
    event_payload->'resubmission_policy',
    event_payload->'file_policy',
    event_payload->>'state'
  )
  RETURNING id, to_jsonb(events.*) INTO new_event_id, new_event;

  -- Insert organizer as event member (atomicity constraint)
  INSERT INTO public.event_members (
    event_id,
    user_id,
    role,
    status
  ) VALUES (
    new_event_id,
    (event_payload->>'organizer_id')::uuid,
    'Organizer',
    'accepted'
  );

  -- Return the full created event row as JSON
  RETURN new_event;
END;
$$;
