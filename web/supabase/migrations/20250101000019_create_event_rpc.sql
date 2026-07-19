-- Migration: Create Event RPC for Transactional Boundary
-- This allows the application service layer to atomically create an event and assign the organizer as an Event Member

CREATE OR REPLACE FUNCTION public.create_event_with_member(event_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as elevated privileges so it can insert regardless of RLS in this specific transaction, though we enforce business logic beforehand
AS $$
DECLARE
  new_event_id uuid;
  new_event jsonb;
BEGIN
  -- Insert into events table
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
    event_payload->'resubmission_policy',
    event_payload->'file_policy',
    event_payload->>'state'
  )
  RETURNING id, to_jsonb(events.*) INTO new_event_id, new_event;

  -- Insert into event_members table (Atomicity constraint)
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

  -- Return the created event
  RETURN new_event;
END;
$$;
