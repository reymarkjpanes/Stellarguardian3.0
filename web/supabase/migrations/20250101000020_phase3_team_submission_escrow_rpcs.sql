-- Migration: Phase 3 DDD Enforcements
-- Applies required schema changes for Teams, Submissions, and Escrow domains based on Phase 3 approval.

-- 1. Team Constraints on Events
ALTER TABLE events
  ADD COLUMN min_team_size INT NOT NULL DEFAULT 1,
  ADD COLUMN max_team_size INT NOT NULL DEFAULT 5,
  ADD COLUMN max_teams INT; -- NULL means unlimited

-- 2. Update status enumerations if needed
-- team_join_requests status: pending, accepted, rejected, cancelled, expired
ALTER TABLE team_join_requests DROP CONSTRAINT IF EXISTS team_join_requests_status_check;
ALTER TABLE team_join_requests ADD CONSTRAINT team_join_requests_status_check 
  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired'));

-- submissions status: Draft, Submitted, Resubmitted, Final
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check 
  CHECK (status IN ('Draft', 'Submitted', 'Resubmitted', 'Final'));

-- 3. RPC: Create Team with Captain
CREATE OR REPLACE FUNCTION create_team_with_captain(
  p_event_id UUID,
  p_name VARCHAR(100),
  p_captain_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id UUID;
  v_event_state VARCHAR;
  v_user_role VARCHAR;
  v_existing_team UUID;
  v_max_teams INT;
  v_current_team_count INT;
BEGIN
  -- Validate event state
  SELECT state, max_teams INTO v_event_state, v_max_teams
  FROM events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event_state NOT IN ('RegistrationOpen', 'RegistrationClosed') THEN
    RAISE EXCEPTION 'Event is not in TeamFormation phase';
  END IF;

  -- Validate participant
  SELECT role INTO v_user_role
  FROM event_members
  WHERE event_id = p_event_id AND user_id = p_captain_id AND status = 'accepted';

  IF v_user_role != 'Participant' THEN
    RAISE EXCEPTION 'Only accepted participants can create teams';
  END IF;

  -- Ensure user not already in a team
  SELECT tm.team_id INTO v_existing_team
  FROM team_members tm
  JOIN teams t ON tm.team_id = t.id
  WHERE t.event_id = p_event_id AND tm.user_id = p_captain_id;

  IF v_existing_team IS NOT NULL THEN
    RAISE EXCEPTION 'User is already in a team for this event';
  END IF;

  -- Enforce max_teams if set
  IF v_max_teams IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_team_count FROM teams WHERE event_id = p_event_id;
    IF v_current_team_count >= v_max_teams THEN
      RAISE EXCEPTION 'Maximum number of teams reached for this event';
    END IF;
  END IF;

  -- Insert team
  INSERT INTO teams (event_id, name, captain_id)
  VALUES (p_event_id, p_name, p_captain_id)
  RETURNING id INTO v_team_id;

  -- Insert captain as member
  INSERT INTO team_members (team_id, user_id)
  VALUES (v_team_id, p_captain_id);

  RETURN v_team_id;
END;
$$;

-- 4. RPC: Resolve Team Join Request
CREATE OR REPLACE FUNCTION resolve_team_join_request(
  p_request_id UUID,
  p_action VARCHAR,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_team RECORD;
  v_event RECORD;
  v_new_status VARCHAR;
  v_member_count INT;
BEGIN
  SELECT * INTO v_request FROM team_join_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending request not found';
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = v_request.team_id FOR UPDATE;
  
  IF v_team.captain_id != p_user_id THEN
    RAISE EXCEPTION 'Only the team captain can resolve join requests';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_team.event_id;

  IF p_action = 'accept' THEN
    -- Check max team size
    SELECT COUNT(*) INTO v_member_count FROM team_members WHERE team_id = v_team.id;
    IF v_member_count >= v_event.max_team_size THEN
      RAISE EXCEPTION 'Team is already at maximum capacity';
    END IF;
    
    v_new_status := 'accepted';
  ELSE
    v_new_status := 'rejected';
  END IF;

  -- Update request
  UPDATE team_join_requests
  SET status = v_new_status, resolved_at = NOW(), resolved_by = p_user_id
  WHERE id = p_request_id;

  -- If accepted, add to team_members
  IF p_action = 'accept' THEN
    INSERT INTO team_members (team_id, user_id) VALUES (v_team.id, v_request.user_id);
    
    -- Cancel any other pending requests for this user in this event
    UPDATE team_join_requests jr
    SET status = 'cancelled', resolved_at = NOW()
    FROM teams t
    WHERE jr.team_id = t.id AND t.event_id = v_team.event_id 
      AND jr.user_id = v_request.user_id 
      AND jr.status = 'pending' AND jr.id != p_request_id;
  END IF;

  RETURN row_to_json(v_request)::jsonb;
END;
$$;

-- 5. RPC: Submit Project
CREATE OR REPLACE FUNCTION submit_project_with_version(
  p_event_id UUID,
  p_team_id UUID,
  p_submitter_id UUID,
  p_title VARCHAR,
  p_description TEXT,
  p_project_url VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission_id UUID;
  v_existing_submission_id UUID;
  v_event_state VARCHAR;
  v_version_no INT;
BEGIN
  -- Check state
  SELECT state INTO v_event_state FROM events WHERE id = p_event_id;
  IF v_event_state != 'SubmissionOpen' THEN
    RAISE EXCEPTION 'Submissions are not open';
  END IF;

  -- Upsert submission (if team_id is null, fallback to submitter_id)
  SELECT id INTO v_existing_submission_id FROM submissions 
  WHERE event_id = p_event_id 
    AND (team_id = p_team_id OR (team_id IS NULL AND submitter_id = p_submitter_id));

  IF v_existing_submission_id IS NOT NULL THEN
    v_submission_id := v_existing_submission_id;
    UPDATE submissions 
    SET status = 'Resubmitted', current_version = current_version + 1, updated_at = NOW()
    WHERE id = v_submission_id
    RETURNING current_version INTO v_version_no;
  ELSE
    INSERT INTO submissions (event_id, team_id, submitter_id, status, current_version)
    VALUES (p_event_id, p_team_id, p_submitter_id, 'Submitted', 1)
    RETURNING id INTO v_submission_id;
    v_version_no := 1;
  END IF;

  -- Insert version content
  INSERT INTO submission_versions (submission_id, version_no, content, actor_id)
  VALUES (
    v_submission_id, 
    v_version_no, 
    jsonb_build_object('title', p_title, 'description', p_description, 'projectUrl', p_project_url),
    p_submitter_id
  );

  RETURN v_submission_id;
END;
$$;

-- 6. RPC: Fund Escrow
CREATE OR REPLACE FUNCTION fund_escrow(
  p_event_id UUID,
  p_tx_hash VARCHAR,
  p_actor_id UUID,
  p_funding_wallet VARCHAR,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_escrow RECORD;
  v_event RECORD;
  v_new_state VARCHAR;
BEGIN
  SELECT * INTO v_escrow FROM escrow_accounts WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow account not found';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id;

  IF p_amount >= v_event.prize_pool_target AND v_event.prize_pool_target > 0 THEN
    v_new_state := 'FullyFunded';
  ELSE
    v_new_state := 'PartiallyFunded';
  END IF;

  -- Record transaction
  INSERT INTO transactions (event_id, escrow_id, type, tx_hash, amount, from_address, to_address, status, network_mode)
  VALUES (p_event_id, v_escrow.id, 'fund', p_tx_hash, p_amount, p_funding_wallet, v_escrow.stellar_public_key, 'confirmed', 'testnet'); -- using testnet as fallback

  -- Update escrow
  UPDATE escrow_accounts
  SET state = v_new_state, expected_balance = p_amount, last_reconciled_balance = p_amount, funding_wallet = p_funding_wallet, version = version + 1
  WHERE id = v_escrow.id;

  RETURN jsonb_build_object('success', true, 'new_state', v_new_state, 'amount', p_amount);
END;
$$;

-- 7. RPC: Disburse Prizes
CREATE OR REPLACE FUNCTION disburse_prizes(
  p_event_id UUID,
  p_escrow_id UUID,
  p_payments JSONB, -- Array of { "winnerId": "uuid", "recipientId": "uuid", "destination": "address", "amount": "numeric", "txHash": "hash" }
  p_network_mode VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payment JSONB;
BEGIN
  FOR payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    -- Update winner status
    UPDATE winners
    SET disbursement_status = 'disbursed', disbursement_tx_hash = payment->>'txHash'
    WHERE id = (payment->>'winnerId')::UUID;

    -- Insert transaction
    INSERT INTO transactions (event_id, escrow_id, type, tx_hash, amount, from_address, to_address, status, network_mode)
    VALUES (
      p_event_id, 
      p_escrow_id, 
      'disbursement', 
      payment->>'txHash', 
      (payment->>'amount')::NUMERIC, 
      (SELECT stellar_public_key FROM escrow_accounts WHERE id = p_escrow_id), 
      payment->>'destination', 
      'confirmed', 
      p_network_mode
    );
  END LOOP;
  RETURN TRUE;
END;
$$;
