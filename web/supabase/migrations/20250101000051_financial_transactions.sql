-- Migration: financial_transactions (Task 0.5)
--
-- Adds atomic PostgreSQL functions for multi-step financial operations.
-- Each function wraps all DB writes in a single transaction so partial failures
-- cause full rollback — no inconsistent state.

-- complete_disbursement: atomically records all successful payments
CREATE OR REPLACE FUNCTION public.complete_disbursement(
  p_event_id uuid,
  p_escrow_id uuid,
  p_payments jsonb,  -- [{winnerId, recipientId, destination, amount, txHash}]
  p_actor_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_payment jsonb;
  v_paid_count int := 0;
BEGIN
  -- Lock the escrow row
  PERFORM id FROM public.escrow_accounts WHERE id = p_escrow_id FOR UPDATE;

  -- Process each successful payment
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    -- Update prize allocation status
    UPDATE public.prize_allocations
    SET
      allocation_status = 'Paid',
      updated_at = now()
    WHERE id = (v_payment->>'winnerId')::uuid;

    -- Insert confirmed transaction record
    INSERT INTO public.transactions (
      event_id, escrow_id, type, tx_hash, amount,
      from_address, to_address, status, network_mode
    ) VALUES (
      p_event_id,
      p_escrow_id,
      'disbursement',
      v_payment->>'txHash',
      (v_payment->>'amount')::numeric,
      (SELECT stellar_public_key FROM public.escrow_accounts WHERE id = p_escrow_id),
      v_payment->>'destination',
      'confirmed',
      COALESCE(current_setting('app.stellar_network', true), 'testnet')
    ) ON CONFLICT (tx_hash) DO NOTHING;

    v_paid_count := v_paid_count + 1;
  END LOOP;

  -- Write audit record
  INSERT INTO public.audit_records (
    action, actor_id, event_id, resource_type, resource_id, metadata
  ) VALUES (
    'escrow.disburse',
    p_actor_id,
    p_event_id,
    'escrow_accounts',
    p_escrow_id,
    jsonb_build_object('paid_count', v_paid_count)
  );

  RETURN jsonb_build_object('success', true, 'paid_count', v_paid_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- complete_refund: atomically marks escrow refunded and records transaction
CREATE OR REPLACE FUNCTION public.complete_refund(
  p_event_id uuid,
  p_escrow_id uuid,
  p_tx_hash text,
  p_amount numeric,
  p_from_address text,
  p_to_address text,
  p_actor_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_escrow RECORD;
BEGIN
  SELECT * INTO v_escrow FROM public.escrow_accounts WHERE id = p_escrow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow not found: %', p_escrow_id;
  END IF;

  -- Update escrow state
  UPDATE public.escrow_accounts
  SET state = 'Refunded', version = version + 1, updated_at = now()
  WHERE id = p_escrow_id;

  -- Insert refund transaction
  INSERT INTO public.transactions (
    event_id, escrow_id, type, tx_hash, amount,
    from_address, to_address, status, network_mode
  ) VALUES (
    p_event_id, p_escrow_id, 'refund', p_tx_hash, p_amount,
    p_from_address, p_to_address, 'confirmed',
    COALESCE(current_setting('app.stellar_network', true), 'testnet')
  );

  -- Write audit record
  INSERT INTO public.audit_records (
    action, actor_id, event_id, resource_type, resource_id, tx_hash, wallet_address, amount, on_chain_status
  ) VALUES (
    'escrow.refund', p_actor_id, p_event_id, 'escrow_accounts', p_escrow_id,
    p_tx_hash, p_to_address, p_amount, 'confirmed'
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
