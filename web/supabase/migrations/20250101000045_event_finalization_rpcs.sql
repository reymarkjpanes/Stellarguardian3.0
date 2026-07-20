-- Migration: event_finalization_rpcs
-- Supports: Module 6 - Rankings & Finalization

-- 1. Create Ranking Snapshot Table
create table public.event_rankings_snapshot (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  total_score numeric not null,
  normalized_score numeric not null,
  judge_count int not null,
  ranking int not null,
  tie_breaker_reason text,
  strategy text not null,
  created_at timestamptz not null default now()
);

create index idx_event_rankings_snapshot_event on public.event_rankings_snapshot (event_id);
create index idx_event_rankings_snapshot_submission on public.event_rankings_snapshot (submission_id);
create index idx_event_rankings_snapshot_ranking on public.event_rankings_snapshot (event_id, ranking);

-- 2. Finalization RPC (Atomic Transaction)
create or replace function public.finalize_event_judging(
  p_event_id uuid,
  p_rankings_json jsonb,
  p_expected_version int
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_version int;
  v_current_status text;
  r jsonb;
begin
  -- Lock Event for Update
  select version, status into v_current_version, v_current_status 
  from public.events 
  where id = p_event_id 
  for update;

  if v_current_version is null then
    raise exception 'Event not found';
  end if;

  if v_current_version != p_expected_version then
    raise exception 'Concurrency conflict: event version mismatch';
  end if;

  if v_current_status != 'Judging' then
    raise exception 'Event must be in Judging status to finalize.';
  end if;

  -- 1. Lock Evaluations (Update Submitted -> Finalized)
  -- This also ignores Draft/Assigned/Flagged, locking only the valid ones.
  -- Alternatively, we could fail if there are any pending evaluations, but let's just finalize the submitted ones.
  update public.evaluations e
  set 
    status = 'Finalized'::public.evaluation_lifecycle_state,
    version = version + 1,
    updated_at = now()
  from public.submissions s
  where e.submission_id = s.id
    and s.event_id = p_event_id
    and e.status = 'Submitted';

  -- 2. Insert Ranking Snapshots
  -- We use a loop over the JSONB array to insert
  for r in select * from jsonb_array_elements(p_rankings_json) loop
    insert into public.event_rankings_snapshot (
      event_id,
      submission_id,
      total_score,
      normalized_score,
      judge_count,
      ranking,
      tie_breaker_reason,
      strategy
    ) values (
      p_event_id,
      (r->>'submissionId')::uuid,
      (r->>'totalScore')::numeric,
      (r->>'normalizedScore')::numeric,
      (r->>'judgeCount')::int,
      (r->>'ranking')::int,
      r->>'tieBreakerReason',
      r->>'strategy'
    );
  end loop;

  -- 3. Update Event Status
  update public.events
  set 
    status = 'Completed',
    version = version + 1,
    updated_at = now()
  where id = p_event_id;

  -- 4. Emit Domain Event (could use pg_notify, or rely on application level)
  perform pg_notify('event_finalized', json_build_object('event_id', p_event_id)::text);

end;
$$;
