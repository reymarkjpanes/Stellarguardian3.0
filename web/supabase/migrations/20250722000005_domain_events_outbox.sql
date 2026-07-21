-- Migration: domain_events_outbox
-- Transactional outbox for reliable domain event processing.
-- Events are written in the same transaction as the business operation,
-- then processed asynchronously by a background worker.
-- Requirements: H3 (publisher loses events), Req 20.3

CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'dead')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  next_retry_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the background processor query
CREATE INDEX idx_domain_events_pending
  ON public.domain_events (next_retry_at)
  WHERE status = 'pending';

-- Index for cleanup of old processed events
CREATE INDEX idx_domain_events_processed
  ON public.domain_events (processed_at)
  WHERE status = 'processed';

COMMENT ON TABLE public.domain_events IS
  'Transactional outbox for domain events. Written atomically with business ops, processed asynchronously.';

-- RPC: Atomic funding confirmation (C8 — transaction boundaries)
-- Wraps escrow state update + transaction record + audit in one transaction.
CREATE OR REPLACE FUNCTION public.rpc_confirm_funding(
  p_event_id uuid,
  p_escrow_id uuid,
  p_tx_hash text,
  p_amount numeric,
  p_funding_wallet text,
  p_actor_id uuid,
  p_network_mode text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target numeric;
  v_new_balance numeric;
  v_new_state text;
BEGIN
  -- Get current expected balance and target
  SELECT expected_balance, (SELECT prize_pool_target FROM events WHERE id = p_event_id)
  INTO v_new_balance, v_target
  FROM escrow_accounts WHERE id = p_escrow_id;

  v_new_balance := v_new_balance + p_amount;

  -- Determine new state
  IF v_target IS NOT NULL AND v_new_balance >= v_target THEN
    v_new_state := 'FullyFunded';
  ELSE
    v_new_state := 'PartiallyFunded';
  END IF;

  -- 1. Update escrow state
  UPDATE escrow_accounts SET
    state = v_new_state,
    expected_balance = v_new_balance,
    funding_wallet = p_funding_wallet,
    version = version + 1
  WHERE id = p_escrow_id;

  -- 2. Insert transaction record
  INSERT INTO transactions (event_id, escrow_id, type, tx_hash, amount, from_address, to_address, status, network_mode)
  VALUES (
    p_event_id, p_escrow_id, 'fund', p_tx_hash, p_amount,
    p_funding_wallet,
    (SELECT stellar_public_key FROM escrow_accounts WHERE id = p_escrow_id),
    'confirmed', p_network_mode
  );

  -- 3. Write audit record
  INSERT INTO audit_records (action, actor_id, event_id, resource_type, resource_id, tx_hash, wallet_address, amount, on_chain_status, metadata)
  VALUES ('escrow.fund', p_actor_id, p_event_id, 'escrow_accounts', p_escrow_id,
    p_tx_hash, p_funding_wallet, p_amount, 'confirmed',
    jsonb_build_object('new_state', v_new_state, 'new_balance', v_new_balance));

  -- 4. Write domain event to outbox
  INSERT INTO domain_events (type, payload)
  VALUES ('FundingCompleted', jsonb_build_object(
    'eventId', p_event_id,
    'escrowId', p_escrow_id,
    'txHash', p_tx_hash,
    'amount', p_amount,
    'fundingWallet', p_funding_wallet,
    'newState', v_new_state,
    'actorId', p_actor_id
  ));

  RETURN jsonb_build_object(
    'success', true,
    'new_state', v_new_state,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_confirm_funding IS
  'Atomic funding confirmation: escrow state + transaction + audit + domain event in one commit.';

-- RPC: Atomic disbursement recording
CREATE OR REPLACE FUNCTION public.rpc_record_disbursement_batch(
  p_event_id uuid,
  p_escrow_id uuid,
  p_payments jsonb,
  p_network_mode text,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment jsonb;
  v_paid_count int := 0;
  v_escrow_pubkey text;
BEGIN
  SELECT stellar_public_key INTO v_escrow_pubkey
  FROM escrow_accounts WHERE id = p_escrow_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    -- Update winner status
    UPDATE winners SET disbursement_status = 'disbursed'
    WHERE id = (v_payment->>'winner_id')::uuid;

    -- Record transaction
    INSERT INTO transactions (event_id, escrow_id, type, tx_hash, amount, from_address, to_address, status, network_mode)
    VALUES (p_event_id, p_escrow_id, 'disbursement',
      v_payment->>'tx_hash', (v_payment->>'amount')::numeric,
      v_escrow_pubkey, v_payment->>'destination', 'confirmed', p_network_mode);

    v_paid_count := v_paid_count + 1;
  END LOOP;

  -- Audit
  INSERT INTO audit_records (action, actor_id, event_id, resource_type, resource_id, metadata)
  VALUES ('escrow.disburse', p_actor_id, p_event_id, 'escrow_accounts', p_escrow_id,
    jsonb_build_object('paid_count', v_paid_count, 'batch_size', jsonb_array_length(p_payments)));

  -- Domain event
  INSERT INTO domain_events (type, payload)
  VALUES ('PrizeReleased', jsonb_build_object(
    'eventId', p_event_id,
    'escrowId', p_escrow_id,
    'paidCount', v_paid_count,
    'actorId', p_actor_id
  ));

  RETURN jsonb_build_object('paid_count', v_paid_count);
END;
$$;

COMMENT ON FUNCTION public.rpc_record_disbursement_batch IS
  'Atomic disbursement recording: winner status + transactions + audit + domain event in one commit.';
