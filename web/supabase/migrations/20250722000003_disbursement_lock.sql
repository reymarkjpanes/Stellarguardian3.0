-- Migration: disbursement_lock
-- Prevents double-disbursement via PostgreSQL advisory locks.
-- Requirements: C1 (double-spend prevention), Req 4.4, 9.3

-- begin_disbursement: Acquires advisory lock + transitions escrow to PendingRelease
-- Returns true if lock acquired and state valid, false otherwise.
CREATE OR REPLACE FUNCTION public.begin_disbursement(
  p_event_id uuid,
  p_actor_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_acquired boolean;
  v_escrow_id uuid;
BEGIN
  -- Non-blocking advisory lock keyed on event_id hash
  SELECT pg_try_advisory_xact_lock(hashtext(p_event_id::text)) INTO v_lock_acquired;
  IF NOT v_lock_acquired THEN
    RETURN false;
  END IF;

  -- Transition escrow to PendingRelease (atomic guard)
  UPDATE public.escrow_accounts
  SET state = 'PendingRelease', version = version + 1
  WHERE event_id = p_event_id
    AND state IN ('Locked', 'FullyFunded')
  RETURNING id INTO v_escrow_id;

  IF v_escrow_id IS NULL THEN
    RETURN false;
  END IF;

  -- Audit the lock acquisition
  INSERT INTO public.audit_records (action, actor_id, event_id, resource_type, resource_id, metadata)
  VALUES ('escrow.begin_disbursement', p_actor_id, p_event_id, 'escrow_accounts', v_escrow_id,
    jsonb_build_object('locked_at', now()::text));

  RETURN true;
END;
$$;

-- complete_disbursement: Transitions escrow to Released after successful payout
CREATE OR REPLACE FUNCTION public.complete_disbursement(
  p_event_id uuid,
  p_actor_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_escrow_id uuid;
BEGIN
  UPDATE public.escrow_accounts
  SET state = 'Released', version = version + 1
  WHERE event_id = p_event_id
    AND state = 'PendingRelease'
  RETURNING id INTO v_escrow_id;

  IF v_escrow_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_records (action, actor_id, event_id, resource_type, resource_id, metadata)
  VALUES ('escrow.complete_disbursement', p_actor_id, p_event_id, 'escrow_accounts', v_escrow_id,
    jsonb_build_object('completed_at', now()::text));

  RETURN true;
END;
$$;

-- abort_disbursement: Rolls back escrow state on failure
CREATE OR REPLACE FUNCTION public.abort_disbursement(
  p_event_id uuid,
  p_revert_to_state text DEFAULT 'Locked'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.escrow_accounts
  SET state = p_revert_to_state, version = version + 1
  WHERE event_id = p_event_id
    AND state = 'PendingRelease';

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.begin_disbursement(uuid, uuid) IS
  'Acquires advisory lock + transitions escrow to PendingRelease. Prevents double-disbursement.';
COMMENT ON FUNCTION public.complete_disbursement(uuid, uuid) IS
  'Transitions escrow to Released after successful payout batch.';
COMMENT ON FUNCTION public.abort_disbursement(uuid, text) IS
  'Reverts escrow from PendingRelease on failure.';
