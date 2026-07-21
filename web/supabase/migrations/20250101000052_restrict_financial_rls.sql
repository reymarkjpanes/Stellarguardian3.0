-- Migration: restrict_financial_rls (Task 1.3)
--
-- Migration 48 set USING (true) on financial tables — anyone can read
-- escrow data, payout instructions, etc. This migration replaces all
-- permissive policies with workspace-scoped policies.

-- ================================================================
-- escrow_accounts — readable only by workspace members
-- ================================================================
DROP POLICY IF EXISTS "escrows_select" ON public.escrow_accounts;

CREATE POLICY "escrows_select" ON public.escrow_accounts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.workspace_members wm ON wm.workspace_id = e.workspace_id
    WHERE e.id = event_id
      AND wm.user_id = (SELECT auth.uid())
  )
);

-- Service role bypass (used by API routes via createServiceClient)
CREATE POLICY "escrows_service_all" ON public.escrow_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- transactions — readable only by workspace members
-- ================================================================
DROP POLICY IF EXISTS "transactions_select" ON public.transactions;

CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.workspace_members wm ON wm.workspace_id = e.workspace_id
    WHERE e.id = event_id
      AND wm.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "transactions_service_all" ON public.transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- payout_batches — readable only by workspace members via escrow join
-- ================================================================
DROP POLICY IF EXISTS "payout_batches_select" ON public.payout_batches;

CREATE POLICY "payout_batches_select" ON public.payout_batches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.escrow_accounts ea
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.workspace_members wm ON wm.workspace_id = e.workspace_id
    WHERE ea.id = escrow_id
      AND wm.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "payout_batches_service_all" ON public.payout_batches
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- payout_instructions — readable only by workspace members
-- ================================================================
DROP POLICY IF EXISTS "payout_instructions_select" ON public.payout_instructions;

CREATE POLICY "payout_instructions_select" ON public.payout_instructions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.payout_batches pb
    JOIN public.escrow_accounts ea ON ea.id = pb.escrow_id
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.workspace_members wm ON wm.workspace_id = e.workspace_id
    WHERE pb.id = payout_batch_id
      AND wm.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "payout_instructions_service_all" ON public.payout_instructions
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- wallet_verifications — readable only by the owning user
-- ================================================================
DROP POLICY IF EXISTS "wallet_verifications_select" ON public.wallet_verifications;

CREATE POLICY "wallet_verifications_select" ON public.wallet_verifications FOR SELECT USING (
  owner_id = (SELECT auth.uid())
);

CREATE POLICY "wallet_verifications_service_all" ON public.wallet_verifications
  FOR ALL USING (auth.role() = 'service_role');
