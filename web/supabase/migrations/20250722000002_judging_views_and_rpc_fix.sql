-- Migration: judging_views_and_rpc_fix
-- Idempotently creates the judging analytics views and fixes the
-- finalization RPC which referenced the wrong column (status → state)
-- and a non-existent enum (evaluation_lifecycle_state).
-- Run this if migration 20250101000045 / 20250101000046 were never applied.

-- ============================================================================
-- 1. Ranking Snapshot Table (idempotent)
-- ============================================================================
create table if not exists public.event_rankings_snapshot (
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

create index if not exists idx_event_rankings_snapshot_event
  on public.event_rankings_snapshot (event_id);
create index if not exists idx_event_rankings_snapshot_submission
  on public.event_rankings_snapshot (submission_id);
create index if not exists idx_event_rankings_snapshot_ranking
  on public.event_rankings_snapshot (event_id, ranking);

-- ============================================================================
-- 2. Analytics Views (create or replace = idempotent)
-- ============================================================================

-- Live ranking preview — average score per submission before finalization
create or replace view public.view_live_rankings as
select
  s.event_id,
  s.id as submission_id,
  t.name as title,
  count(e.id) as judge_count,
  avg((e.total_score)::numeric) as average_score,
  max((e.total_score)::numeric) as highest_score,
  min((e.total_score)::numeric) as lowest_score
from public.submissions s
left join public.teams t on s.team_id = t.id
left join public.evaluations e
  on e.submission_id = s.id
  and e.status = 'Submitted'
group by s.event_id, s.id, t.name
order by average_score desc nulls last;

-- Judging progress — how many evaluations are done vs pending per event
create or replace view public.view_judging_progress as
select
  s.event_id,
  count(e.id) as total_assigned,
  count(e.id) filter (where e.status = 'Draft')    as count_draft,
  count(e.id) filter (where e.status in ('Submitted', 'Finalized')) as count_completed,
  count(e.id) filter (where e.status = 'Flagged')  as count_flagged
from public.evaluations e
join public.submissions s on e.submission_id = s.id
group by s.event_id;

-- Judge workload — per-judge progress within an event
create or replace view public.view_judge_workload as
select
  s.event_id,
  e.judge_id,
  count(e.id) as assigned_count,
  count(e.id) filter (where e.status in ('Submitted', 'Finalized')) as completed_count,
  case
    when count(e.id) = 0 then 0
    else (
      count(e.id) filter (where e.status in ('Submitted', 'Finalized'))::numeric
      / count(e.id)
    ) * 100
  end as completion_percentage
from public.evaluations e
join public.submissions s on e.submission_id = s.id
group by s.event_id, e.judge_id;

-- Scoring variance — identifies harsh/lenient judges
create or replace view public.view_scoring_variance as
with judge_averages as (
  select
    s.event_id,
    e.judge_id,
    avg((e.total_score)::numeric) as judge_avg
  from public.evaluations e
  join public.submissions s on e.submission_id = s.id
  where e.status in ('Submitted', 'Finalized')
  group by s.event_id, e.judge_id
),
event_averages as (
  select
    event_id,
    avg(judge_avg) as global_avg
  from judge_averages
  group by event_id
)
select
  ja.event_id,
  ja.judge_id,
  ja.judge_avg,
  ea.global_avg,
  (ja.judge_avg - ea.global_avg) as variance
from judge_averages ja
join event_averages ea on ja.event_id = ea.event_id;

-- ============================================================================
-- 3. Finalization RPC — fixed version
--    Changes from the original broken version:
--    - events.status → events.state  (correct column name per schema)
--    - Removed cast to public.evaluation_lifecycle_state (use text directly)
--    - Judging state check now uses canonical value 'JudgingRound1'
--    - Transition target changed to 'WinnerVerification' (canonical state)
-- ============================================================================
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
  v_current_state text;
  r jsonb;
begin
  -- Lock Event row for update (prevents concurrent finalization)
  select version, state
  into v_current_version, v_current_state
  from public.events
  where id = p_event_id
  for update;

  if v_current_version is null then
    raise exception 'Event not found';
  end if;

  if v_current_version != p_expected_version then
    raise exception 'Concurrency conflict: event version mismatch (expected %, got %)',
      p_expected_version, v_current_version;
  end if;

  if v_current_state not in ('JudgingRound1', 'JudgingRound2') then
    raise exception 'Event must be in a Judging state to finalize (current: %)', v_current_state;
  end if;

  -- Lock Submitted evaluations → Finalized
  update public.evaluations e
  set
    status      = 'Finalized',
    version     = version + 1,
    updated_at  = now()
  from public.submissions s
  where e.submission_id = s.id
    and s.event_id    = p_event_id
    and e.status      = 'Submitted';

  -- Insert ranking snapshots
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

  -- Advance event state → WinnerVerification
  update public.events
  set
    state      = 'WinnerVerification',
    version    = version + 1,
    updated_at = now()
  where id = p_event_id;

  -- Notify downstream subscribers
  perform pg_notify(
    'event_finalized',
    json_build_object('event_id', p_event_id)::text
  );
end;
$$;
