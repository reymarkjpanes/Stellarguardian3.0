-- Migration: financial_precision
-- Standardizes all financial columns to numeric(20,7) for Stellar precision.
-- Stellar uses 7 decimal places (stroops = 1/10,000,000 XLM).
-- Requirements: M6 (precision), Req 4, 9

-- escrow_accounts
ALTER TABLE public.escrow_accounts
  ALTER COLUMN expected_balance TYPE numeric(20,7),
  ALTER COLUMN last_reconciled_balance TYPE numeric(20,7);

-- transactions
ALTER TABLE public.transactions
  ALTER COLUMN amount TYPE numeric(20,7);

-- winners
ALTER TABLE public.winners
  ALTER COLUMN prize_amount TYPE numeric(20,7);

-- events
ALTER TABLE public.events
  ALTER COLUMN prize_pool_target TYPE numeric(20,7);

-- Add winner uniqueness constraint (H4)
-- Prevents duplicate prize allocation to same recipient in same event.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'winners_event_recipient_unique'
  ) THEN
    ALTER TABLE public.winners
      ADD CONSTRAINT winners_event_recipient_unique UNIQUE (event_id, recipient_id);
  END IF;
END;
$$;

COMMENT ON CONSTRAINT winners_event_recipient_unique ON public.winners IS
  'Prevents duplicate prize allocation to same recipient in same event (H4).';
