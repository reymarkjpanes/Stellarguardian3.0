-- Migrate from simple 'winners' table to a more robust Prize Allocation domain.

-- 1. Drop existing winners table if it exists (since we're re-modeling)
DROP TABLE IF EXISTS public.winners;

-- 2. Create Prize Categories
CREATE TABLE public.prize_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  prize_type text not null check (prize_type in ('Cash', 'Token', 'NFT', 'Physical', 'Certificate', 'Scholarship', 'Internship')),
  total_amount numeric not null check (total_amount >= 0),
  currency text, -- NULL if non-fungible/physical
  max_winners int not null default 1 check (max_winners > 0),
  sponsor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create Prize Allocation Batches
CREATE TABLE public.prize_allocation_batches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade unique,
  status text not null default 'Draft' check (status in ('Draft', 'Validated', 'Locked', 'Escrowed')),
  locked_at timestamptz,
  locked_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create Prize Allocations
CREATE TABLE public.prize_allocations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.prize_allocation_batches(id) on delete cascade,
  category_id uuid not null references public.prize_categories(id) on delete restrict,
  submission_id uuid not null references public.submissions(id) on delete restrict,
  team_id uuid references public.teams(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  allocation_status text not null default 'Draft' check (allocation_status in ('Draft', 'Validated', 'Locked', 'Escrowed', 'Paid', 'Cancelled')),
  allocation_reason text,
  ranking_snapshot_id uuid references public.event_rankings_snapshot(id) on delete set null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 0,
  -- ensure a submission can only win a specific category once
  unique (category_id, submission_id)
);

-- 5. RPCs for Centralized Business Rules

CREATE OR REPLACE FUNCTION public.allocate_prize(
  p_batch_id uuid,
  p_category_id uuid,
  p_submission_id uuid,
  p_amount numeric,
  p_reason text,
  p_ranking_snapshot_id uuid,
  p_user_id uuid
) RETURNS uuid AS $$
DECLARE
  v_batch_status text;
  v_cat_total numeric;
  v_cat_max_winners int;
  v_current_allocated numeric;
  v_current_winners int;
  v_team_id uuid;
  v_new_allocation_id uuid;
BEGIN
  -- 1. Check Batch Status
  SELECT status INTO v_batch_status FROM public.prize_allocation_batches WHERE id = p_batch_id;
  IF v_batch_status IN ('Locked', 'Escrowed') THEN
    RAISE EXCEPTION 'Cannot modify allocations in a % batch.', v_batch_status;
  END IF;

  -- 2. Check Category Constraints
  SELECT total_amount, max_winners INTO v_cat_total, v_cat_max_winners 
  FROM public.prize_categories WHERE id = p_category_id;

  SELECT COALESCE(SUM(amount), 0), COUNT(*) 
  INTO v_current_allocated, v_current_winners
  FROM public.prize_allocations 
  WHERE category_id = p_category_id;

  IF (v_current_allocated + p_amount) > v_cat_total THEN
    RAISE EXCEPTION 'Allocation exceeds category budget.';
  END IF;

  IF (v_current_winners + 1) > v_cat_max_winners THEN
    RAISE EXCEPTION 'Category has reached max winners.';
  END IF;

  -- 3. Resolve Team ID
  SELECT team_id INTO v_team_id FROM public.submissions WHERE id = p_submission_id;

  -- 4. Insert Allocation
  INSERT INTO public.prize_allocations (
    batch_id, category_id, submission_id, team_id, amount, allocation_status, allocation_reason, ranking_snapshot_id, created_by
  ) VALUES (
    p_batch_id, p_category_id, p_submission_id, v_team_id, p_amount, 'Draft', p_reason, p_ranking_snapshot_id, p_user_id
  ) RETURNING id INTO v_new_allocation_id;

  RETURN v_new_allocation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.lock_prize_allocations(
  p_batch_id uuid,
  p_user_id uuid
) RETURNS void AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.prize_allocation_batches WHERE id = p_batch_id FOR UPDATE;
  
  IF v_status != 'Draft' AND v_status != 'Validated' THEN
    RAISE EXCEPTION 'Batch is already locked or escrowed.';
  END IF;

  UPDATE public.prize_allocation_batches 
  SET status = 'Locked', locked_at = now(), locked_by = p_user_id
  WHERE id = p_batch_id;

  UPDATE public.prize_allocations
  SET allocation_status = 'Locked', updated_at = now()
  WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.update_prize_allocation(
  p_allocation_id uuid,
  p_amount numeric,
  p_reason text,
  p_user_id uuid
) RETURNS void AS $$
DECLARE
  v_batch_id uuid;
  v_batch_status text;
  v_category_id uuid;
  v_cat_total numeric;
  v_current_allocated numeric;
  v_old_amount numeric;
BEGIN
  -- 1. Get Allocation and Batch
  SELECT batch_id, category_id, amount INTO v_batch_id, v_category_id, v_old_amount
  FROM public.prize_allocations WHERE id = p_allocation_id;

  SELECT status INTO v_batch_status FROM public.prize_allocation_batches WHERE id = v_batch_id;
  IF v_batch_status IN ('Locked', 'Escrowed') THEN
    RAISE EXCEPTION 'Cannot modify allocations in a % batch.', v_batch_status;
  END IF;

  -- 2. Check Category Constraints
  SELECT COALESCE(SUM(amount), 0) INTO v_current_allocated
  FROM public.prize_allocations 
  WHERE category_id = v_category_id AND id != p_allocation_id;

  SELECT total_amount INTO v_cat_total FROM public.prize_categories WHERE id = v_category_id;

  IF (v_current_allocated + p_amount) > v_cat_total THEN
    RAISE EXCEPTION 'Update exceeds category budget.';
  END IF;

  -- 3. Update
  UPDATE public.prize_allocations
  SET amount = p_amount, allocation_reason = p_reason, updated_at = now(), version = version + 1
  WHERE id = p_allocation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.remove_prize_allocation(
  p_allocation_id uuid,
  p_user_id uuid
) RETURNS void AS $$
DECLARE
  v_batch_id uuid;
  v_batch_status text;
BEGIN
  SELECT batch_id INTO v_batch_id FROM public.prize_allocations WHERE id = p_allocation_id;

  SELECT status INTO v_batch_status FROM public.prize_allocation_batches WHERE id = v_batch_id;
  IF v_batch_status IN ('Locked', 'Escrowed') THEN
    RAISE EXCEPTION 'Cannot modify allocations in a % batch.', v_batch_status;
  END IF;

  DELETE FROM public.prize_allocations WHERE id = p_allocation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

