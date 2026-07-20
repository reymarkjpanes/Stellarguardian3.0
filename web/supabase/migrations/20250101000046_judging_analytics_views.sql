-- Migration: judging_analytics_views
-- Supports: Module 6 - Organizer Analytics & Dashboards

-- 1. view_submission_rankings (Dynamic pre-finalization ranking overview)
-- This view allows organizers to see a LIVE average of scores before finalization
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

-- 2. view_judging_progress
-- Shows how many evaluations are completed vs assigned per event
create or replace view public.view_judging_progress as
select
  s.event_id,
  count(e.id) as total_assigned,
  count(e.id) filter (where e.status = 'Draft') as count_draft,
  count(e.id) filter (where e.status = 'Submitted' or e.status = 'Finalized') as count_completed,
  count(e.id) filter (where e.status = 'Flagged') as count_flagged
from public.evaluations e
join public.submissions s on e.submission_id = s.id
group by s.event_id;

-- 3. view_judge_workload
-- Shows progress per judge for an event
create or replace view public.view_judge_workload as
select
  s.event_id,
  e.judge_id,
  count(e.id) as assigned_count,
  count(e.id) filter (where e.status = 'Submitted' or e.status = 'Finalized') as completed_count,
  case 
    when count(e.id) = 0 then 0 
    else (count(e.id) filter (where e.status = 'Submitted' or e.status = 'Finalized')::numeric / count(e.id)) * 100 
  end as completion_percentage
from public.evaluations e
join public.submissions s on e.submission_id = s.id
group by s.event_id, e.judge_id;

-- 4. view_scoring_variance
-- Identifies harsh or lenient judges by comparing their average score vs the event average
create or replace view public.view_scoring_variance as
with judge_averages as (
  select 
    s.event_id,
    e.judge_id,
    avg((e.total_score)::numeric) as judge_avg
  from public.evaluations e
  join public.submissions s on e.submission_id = s.id
  where e.status = 'Submitted' or e.status = 'Finalized'
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
