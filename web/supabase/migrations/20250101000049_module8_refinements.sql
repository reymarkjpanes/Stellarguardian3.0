-- Migration: module8_refinements
-- Supports: Sprint 8.2 - Enums additions, Settlement constraints, Fee Accounting

-- 1. Alter Enums (Postgres requires adding values)
ALTER TYPE public.payout_batch_status ADD VALUE IF NOT EXISTS 'Broadcasting' AFTER 'Signing';
ALTER TYPE public.payout_batch_status ADD VALUE IF NOT EXISTS 'Partially Completed' AFTER 'Confirmed';

ALTER TYPE public.payout_instruction_status ADD VALUE IF NOT EXISTS 'Finalized' AFTER 'Confirmed';

ALTER TYPE public.wallet_verification_status ADD VALUE IF NOT EXISTS 'Revoked' AFTER 'Expired';

-- 2. Add Fee Accounting to payout_batches
ALTER TABLE public.payout_batches
ADD COLUMN IF NOT EXISTS fee_asset text,
ADD COLUMN IF NOT EXISTS network_fee numeric DEFAULT 0 CHECK (network_fee >= 0),
ADD COLUMN IF NOT EXISTS provider_fee numeric DEFAULT 0 CHECK (provider_fee >= 0),
ADD COLUMN IF NOT EXISTS total_fee numeric DEFAULT 0 CHECK (total_fee >= 0),
ADD COLUMN IF NOT EXISTS fee_payer text;

-- 3. Update Payout Instruction Status RPC (to support Finalized)
-- No structural change needed to the RPC since it takes the enum directly,
-- but we might want to record failure reasons more explicitly or retries.

-- 4. Create RPC for Settlement Reconciliation
CREATE OR REPLACE FUNCTION public.reconcile_settlement(
  p_batch_id uuid,
  p_user_id uuid,
  p_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_batch RECORD;
  v_pending_count int;
  v_total_paid numeric;
  v_settlement_id uuid;
BEGIN
  -- Fetch the batch
  SELECT * INTO v_batch FROM public.payout_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  -- Ensure all instructions are terminal (Confirmed, Finalized, or Failed)
  SELECT count(*) INTO v_pending_count 
  FROM public.payout_instructions 
  WHERE payout_batch_id = p_batch_id 
    AND status NOT IN ('Confirmed', 'Finalized', 'Failed');
    
  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'Cannot settle: % instructions are not in a terminal state.', v_pending_count;
  END IF;

  -- Calculate totals
  SELECT COALESCE(sum(amount), 0) INTO v_total_paid
  FROM public.payout_instructions
  WHERE payout_batch_id = p_batch_id AND status IN ('Confirmed', 'Finalized');

  -- Create immutable settlement
  INSERT INTO public.settlements (
    escrow_id, 
    payout_batch_id, 
    reconciled_amount, 
    discrepancy_amount, 
    settled_by, 
    notes
  )
  VALUES (
    v_batch.escrow_id,
    p_batch_id,
    v_total_paid,
    v_batch.total_amount - v_total_paid,
    p_user_id,
    p_notes
  ) RETURNING id INTO v_settlement_id;

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
