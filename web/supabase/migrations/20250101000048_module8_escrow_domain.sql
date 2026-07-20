-- Migration: module8_escrow_domain
-- Supports: Module 8 - Escrow & Payouts (Financial Domain)

-- 1. Clean up legacy schema
DROP FUNCTION IF EXISTS public.fund_escrow(uuid, text, numeric, text);
DROP FUNCTION IF EXISTS public.disburse_escrow(uuid);

DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.escrow_accounts CASCADE;

-- 2. Define Enums for Module 8 State Machines
CREATE TYPE public.escrow_status AS ENUM (
  'Draft',
  'Funding',
  'Funded',
  'Verified',
  'Locked',
  'Releasing',
  'Completed',
  'Refunded'
);

CREATE TYPE public.payout_batch_status AS ENUM (
  'Pending',
  'Preparing',
  'Signing',
  'Broadcast',
  'Confirmed',
  'Failed',
  'Retried'
);

CREATE TYPE public.payout_instruction_status AS ENUM (
  'Pending',
  'Broadcast',
  'Confirmed',
  'Failed',
  'Retry'
);

CREATE TYPE public.wallet_owner_type AS ENUM (
  'User',
  'Team',
  'Organization',
  'Sponsor'
);

CREATE TYPE public.wallet_verification_status AS ENUM (
  'Pending',
  'Verified',
  'Failed',
  'Expired'
);

-- 3. Create Module 8 Schema

-- Wallet Verifications
CREATE TABLE public.wallet_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.wallet_owner_type NOT NULL,
  owner_id uuid NOT NULL,
  wallet_address text NOT NULL CHECK (wallet_address ~ '^G[A-Z2-7]{55}$'),
  verification_method text NOT NULL,
  status public.wallet_verification_status NOT NULL DEFAULT 'Pending',
  nonce text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, wallet_address)
);

-- Escrow Accounts
CREATE TABLE public.escrow_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  prize_allocation_batch_id uuid REFERENCES public.prize_allocation_batches(id) ON DELETE RESTRICT,
  status public.escrow_status NOT NULL DEFAULT 'Draft',
  expected_balance numeric NOT NULL DEFAULT 0 CHECK (expected_balance >= 0),
  available_balance numeric NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  locked_balance numeric NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  contract_address text,
  network text NOT NULL DEFAULT 'testnet',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Funding Transactions
CREATE TABLE public.funding_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id uuid NOT NULL REFERENCES public.escrow_accounts(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  funding_source_type text NOT NULL, -- e.g. OrganizerWallet, SponsorWallet
  funding_source_id text,
  tx_hash text NOT NULL UNIQUE,
  block_height bigint,
  verified_by_provider text,
  status text NOT NULL DEFAULT 'Verified',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payout Batches
CREATE TABLE public.payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id uuid NOT NULL REFERENCES public.escrow_accounts(id) ON DELETE RESTRICT,
  prize_allocation_batch_id uuid NOT NULL REFERENCES public.prize_allocation_batches(id) ON DELETE RESTRICT,
  status public.payout_batch_status NOT NULL DEFAULT 'Pending',
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  idempotency_key text UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payout Instructions
CREATE TABLE public.payout_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id uuid NOT NULL REFERENCES public.payout_batches(id) ON DELETE CASCADE,
  allocation_id uuid NOT NULL REFERENCES public.prize_allocations(id) ON DELETE RESTRICT,
  recipient_wallet text NOT NULL CHECK (recipient_wallet ~ '^G[A-Z2-7]{55}$'),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  status public.payout_instruction_status NOT NULL DEFAULT 'Pending',
  retries int NOT NULL DEFAULT 0,
  tx_hash text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Settlements
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id uuid NOT NULL REFERENCES public.escrow_accounts(id) ON DELETE RESTRICT,
  payout_batch_id uuid NOT NULL REFERENCES public.payout_batches(id) ON DELETE RESTRICT,
  reconciled_amount numeric NOT NULL,
  discrepancy_amount numeric NOT NULL DEFAULT 0,
  settled_at timestamptz NOT NULL DEFAULT now(),
  settled_by uuid NOT NULL REFERENCES auth.users(id),
  notes text
);

-- 4. Create RPCs for Transactional State Changes

-- Create Escrow
CREATE OR REPLACE FUNCTION public.create_escrow_account(
  p_event_id uuid,
  p_batch_id uuid,
  p_expected_balance numeric,
  p_user_id uuid
) RETURNS uuid AS $$
DECLARE
  v_escrow_id uuid;
BEGIN
  INSERT INTO public.escrow_accounts (event_id, prize_allocation_batch_id, expected_balance, created_by)
  VALUES (p_event_id, p_batch_id, p_expected_balance, p_user_id)
  RETURNING id INTO v_escrow_id;
  
  RETURN v_escrow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify Funding
CREATE OR REPLACE FUNCTION public.record_funding_verification(
  p_escrow_id uuid,
  p_amount numeric,
  p_source_type text,
  p_tx_hash text,
  p_block_height bigint,
  p_provider text
) RETURNS void AS $$
DECLARE
  v_escrow RECORD;
BEGIN
  SELECT * INTO v_escrow FROM public.escrow_accounts WHERE id = p_escrow_id FOR UPDATE;
  
  INSERT INTO public.funding_transactions (escrow_id, amount, funding_source_type, tx_hash, block_height, verified_by_provider)
  VALUES (p_escrow_id, p_amount, p_source_type, p_tx_hash, p_block_height, p_provider);
  
  UPDATE public.escrow_accounts
  SET 
    available_balance = available_balance + p_amount,
    status = CASE 
               WHEN (available_balance + p_amount) >= expected_balance THEN 'Funded'::public.escrow_status 
               ELSE 'Funding'::public.escrow_status 
             END,
    updated_at = now(),
    version = version + 1
  WHERE id = p_escrow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate Payout Batch
CREATE OR REPLACE FUNCTION public.generate_payout_batch(
  p_escrow_id uuid,
  p_user_id uuid,
  p_idempotency_key text
) RETURNS uuid AS $$
DECLARE
  v_escrow RECORD;
  v_batch_id uuid;
  v_total_amount numeric;
BEGIN
  SELECT * INTO v_escrow FROM public.escrow_accounts WHERE id = p_escrow_id FOR UPDATE;
  
  IF v_escrow.status != 'Verified' AND v_escrow.status != 'Funded' THEN
    RAISE EXCEPTION 'Escrow must be Verified or Funded to generate payouts.';
  END IF;

  SELECT total_amount INTO v_total_amount FROM public.prize_allocation_batches WHERE id = v_escrow.prize_allocation_batch_id;

  INSERT INTO public.payout_batches (escrow_id, prize_allocation_batch_id, total_amount, idempotency_key, created_by)
  VALUES (p_escrow_id, v_escrow.prize_allocation_batch_id, v_total_amount, p_idempotency_key, p_user_id)
  RETURNING id INTO v_batch_id;

  UPDATE public.escrow_accounts
  SET status = 'Locked', locked_balance = v_total_amount, updated_at = now(), version = version + 1
  WHERE id = p_escrow_id;

  RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Instruction Status
CREATE OR REPLACE FUNCTION public.update_payout_instruction_status(
  p_instruction_id uuid,
  p_status public.payout_instruction_status,
  p_tx_hash text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE public.payout_instructions
  SET 
    status = p_status,
    tx_hash = COALESCE(p_tx_hash, tx_hash),
    failure_reason = p_failure_reason,
    retries = CASE WHEN p_status = 'Retry' THEN retries + 1 ELSE retries END,
    updated_at = now()
  WHERE id = p_instruction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies
ALTER TABLE public.escrow_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrows_select" ON public.escrow_accounts FOR SELECT USING (true);
CREATE POLICY "payout_batches_select" ON public.payout_batches FOR SELECT USING (true);
CREATE POLICY "payout_instructions_select" ON public.payout_instructions FOR SELECT USING (true);
CREATE POLICY "wallet_verifications_select" ON public.wallet_verifications FOR SELECT USING (true);
