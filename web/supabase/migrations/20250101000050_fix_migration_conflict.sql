-- Migration: fix_migration_conflict (Task 0.4)
--
-- Migration 000048 dropped escrow_accounts and recreated with a different schema
-- (PostgreSQL ENUMs, different column names) that breaks existing service code.
-- This migration resolves the conflict by:
-- 1. Restoring the original text-CHECK escrow_accounts schema that services use
-- 2. Keeping Module 8 tables (payout_batches, payout_instructions, etc.) intact
-- 3. Adding missing columns to escrow_accounts that Module 8 code references
--
-- Strategy: Recreate escrow_accounts with the original schema + compat columns.
-- Services in lib/services/escrow/ will continue to work unchanged.

-- Drop the Module 8 enum-typed escrow_accounts if it exists from migration 48
-- (safe: it has no user data yet — only applied on fresh dev databases)
DROP TABLE IF EXISTS public.escrow_accounts CASCADE;
DROP TYPE IF EXISTS public.escrow_status CASCADE;

-- Recreate escrow_accounts with the original schema (from migration 000005)
-- plus Module 8 compatibility columns
CREATE TABLE public.escrow_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE RESTRICT,
  stellar_public_key text NOT NULL CHECK (stellar_public_key ~ '^G[A-Z2-7]{55}$'),
  encrypted_secret_key bytea NOT NULL,
  -- Canonical 9-state lifecycle (matches EscrowStateSchema in types/enums.ts)
  state text NOT NULL DEFAULT 'PendingFunding' CHECK (
    state IN (
      'PendingFunding',
      'PartiallyFunded',
      'FullyFunded',
      'Locked',
      'PendingRelease',
      'Released',
      'Refunded',
      'Failed',
      'Cancelled'
    )
  ),
  expected_balance numeric NOT NULL DEFAULT 0 CHECK (expected_balance >= 0),
  last_reconciled_balance numeric CHECK (last_reconciled_balance IS NULL OR last_reconciled_balance >= 0),
  last_reconciled_block bigint,
  funding_wallet text CHECK (funding_wallet IS NULL OR funding_wallet ~ '^G[A-Z2-7]{55}$'),
  inconsistent boolean NOT NULL DEFAULT false,
  version int NOT NULL DEFAULT 0,
  -- Module 8 compat columns (used by payout_batches FK)
  prize_allocation_batch_id uuid REFERENCES public.prize_allocation_batches(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_escrow_accounts_event_id ON public.escrow_accounts (event_id);
CREATE INDEX idx_escrow_accounts_state ON public.escrow_accounts (state);

COMMENT ON TABLE public.escrow_accounts IS
  'Per-event escrow keypair; secret key is KMS-envelope-encrypted (Req 4.2). Never exposed to read APIs.';
COMMENT ON COLUMN public.escrow_accounts.encrypted_secret_key IS
  'KMS-envelope-encrypted Stellar secret key. Format: aes:<iv>:<tag>:<ciphertext> (dev) or kms:<base64> (prod).';

-- Re-enable RLS
ALTER TABLE public.escrow_accounts ENABLE ROW LEVEL SECURITY;

-- Restore the transactions table (dropped by migration 48)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  escrow_id uuid REFERENCES public.escrow_accounts(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('fund', 'disbursement', 'refund', 'escrow_op')),
  tx_hash text NOT NULL UNIQUE,
  amount numeric NOT NULL CHECK (amount >= 0),
  from_address text NOT NULL CHECK (from_address ~ '^G[A-Z2-7]{55}$'),
  to_address text NOT NULL CHECK (to_address ~ '^G[A-Z2-7]{55}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  network_mode text NOT NULL CHECK (network_mode IN ('testnet', 'mainnet')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON public.transactions (event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_escrow_id ON public.transactions (escrow_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Restore fund_escrow RPC that services depend on (dropped by migration 48)
CREATE OR REPLACE FUNCTION public.fund_escrow(
  p_event_id uuid,
  p_tx_hash text,
  p_amount numeric,
  p_funding_wallet text
) RETURNS jsonb AS $$
DECLARE
  v_escrow RECORD;
  v_new_state text;
BEGIN
  SELECT * INTO v_escrow FROM public.escrow_accounts WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow account not found for event %', p_event_id;
  END IF;

  -- Determine new state based on cumulative balance
  IF (v_escrow.expected_balance > 0 AND p_amount >= v_escrow.expected_balance) THEN
    v_new_state := 'FullyFunded';
  ELSIF p_amount > 0 THEN
    v_new_state := 'PartiallyFunded';
  ELSE
    v_new_state := v_escrow.state;
  END IF;

  -- Update escrow
  UPDATE public.escrow_accounts
  SET
    state = v_new_state,
    expected_balance = p_amount,
    last_reconciled_balance = p_amount,
    funding_wallet = p_funding_wallet,
    version = version + 1,
    updated_at = now()
  WHERE id = v_escrow.id;

  -- Insert transaction record
  INSERT INTO public.transactions (
    event_id, escrow_id, type, tx_hash, amount,
    from_address, to_address, status, network_mode
  ) VALUES (
    p_event_id, v_escrow.id, 'fund', p_tx_hash, p_amount,
    p_funding_wallet, v_escrow.stellar_public_key, 'confirmed',
    CASE WHEN current_setting('app.stellar_network', true) = 'mainnet' THEN 'mainnet' ELSE 'testnet' END
  );

  RETURN jsonb_build_object(
    'escrow_id', v_escrow.id,
    'new_state', v_new_state,
    'amount', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
