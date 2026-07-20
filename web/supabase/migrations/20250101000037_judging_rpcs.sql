-- Migration: judging_rpcs
-- Supports: Module 5 - Judging Engine
-- Note: Requires evaluation_lifecycle_state enum and evaluations table updates from 20250101000022_align_state_machines.sql

-- 0. Alter evaluations table to add missing domain fields
alter table public.evaluations 
add column if not exists version int not null default 0,
add column if not exists total_score numeric not null default 0,
add column if not exists participant_feedback text,
add column if not exists organizer_notes text,
add column if not exists rubric_version int,
add column if not exists updated_at timestamptz not null default now();

-- 1. Assign Judge
create or replace function public.assign_judge_to_submission(
  p_judge_id uuid,
  p_submission_id uuid,
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_eval_id uuid;
begin
  -- Duplicate check
  if exists (select 1 from public.evaluations where judge_id = p_judge_id and submission_id = p_submission_id) then
    raise exception 'Judge is already assigned to this submission.';
  end if;

  -- Create assignment
  insert into public.evaluations (judge_id, submission_id, status, scores, conflict_of_interest, version)
  values (p_judge_id, p_submission_id, 'Assigned'::public.evaluation_lifecycle_state, '{"criteria":[]}'::jsonb, false, 0)
  returning id into v_eval_id;

  return v_eval_id;
end;
$$;

-- 2. Save Draft Evaluation
create or replace function public.save_draft_evaluation(
  p_eval_id uuid,
  p_scores_json jsonb,
  p_draft_notes text,
  p_expected_version int
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_version int;
  v_current_status public.evaluation_lifecycle_state;
begin
  select version, status into v_current_version, v_current_status 
  from public.evaluations 
  where id = p_eval_id 
  for update;

  if v_current_version is null then
    raise exception 'Evaluation not found';
  end if;

  if v_current_version != p_expected_version then
    raise exception 'Concurrency conflict: version mismatch';
  end if;

  if v_current_status not in ('Assigned', 'Draft', 'Submitted') then
    raise exception 'Cannot save draft for evaluation in state %', v_current_status;
  end if;

  update public.evaluations
  set 
    scores = p_scores_json,
    draft_notes = coalesce(p_draft_notes, draft_notes),
    status = case when v_current_status = 'Assigned' then 'Draft'::public.evaluation_lifecycle_state else v_current_status end,
    version = version + 1,
    updated_at = now()
  where id = p_eval_id;
end;
$$;

-- 3. Submit Evaluation
create or replace function public.submit_evaluation(
  p_eval_id uuid,
  p_scores_json jsonb,
  p_participant_feedback text,
  p_organizer_notes text,
  p_total_score numeric,
  p_expected_version int
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_version int;
  v_current_status public.evaluation_lifecycle_state;
begin
  select version, status into v_current_version, v_current_status 
  from public.evaluations 
  where id = p_eval_id 
  for update;

  if v_current_version is null then
    raise exception 'Evaluation not found';
  end if;

  if v_current_version != p_expected_version then
    raise exception 'Concurrency conflict: version mismatch';
  end if;

  if v_current_status not in ('Assigned', 'Draft', 'Submitted') then
    raise exception 'Cannot submit evaluation in state %', v_current_status;
  end if;

  update public.evaluations
  set 
    scores = p_scores_json,
    participant_feedback = coalesce(p_participant_feedback, participant_feedback),
    organizer_notes = coalesce(p_organizer_notes, organizer_notes),
    total_score = p_total_score,
    status = 'Submitted'::public.evaluation_lifecycle_state,
    version = version + 1,
    updated_at = now()
  where id = p_eval_id;
end;
$$;

-- 4. Declare Conflict
create or replace function public.declare_evaluation_conflict(
  p_eval_id uuid,
  p_organizer_notes text,
  p_expected_version int
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_version int;
  v_current_status public.evaluation_lifecycle_state;
begin
  select version, status into v_current_version, v_current_status 
  from public.evaluations 
  where id = p_eval_id 
  for update;

  if v_current_version is null then
    raise exception 'Evaluation not found';
  end if;

  if v_current_version != p_expected_version then
    raise exception 'Concurrency conflict: version mismatch';
  end if;

  update public.evaluations
  set 
    organizer_notes = coalesce(p_organizer_notes, organizer_notes),
    conflict_of_interest = true,
    status = 'Flagged'::public.evaluation_lifecycle_state,
    version = version + 1,
    updated_at = now()
  where id = p_eval_id;
end;
$$;
