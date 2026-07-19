-- Migration: evaluation_criteria, team_join_requests, comments
-- Supports: M3 (configurable rubrics), M6 (team join requests), M14 (comments)

-- evaluation_criteria — configurable judging rubrics per event (M3)
create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  max_score int not null default 100 check (max_score > 0),
  weight numeric not null default 1.0 check (weight > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_evaluation_criteria_event on public.evaluation_criteria (event_id, sort_order);

comment on table public.evaluation_criteria is
  'Per-event judging criteria. Replaces hardcoded Innovation/Technical/Impact (M3).';

-- team_join_requests — self-service team joining (M6)
create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  message text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users (id),
  constraint team_join_requests_unique unique (team_id, user_id, status)
);

create index idx_team_join_requests_team on public.team_join_requests (team_id, status);
create index idx_team_join_requests_user on public.team_join_requests (user_id);

comment on table public.team_join_requests is
  'Self-service team join workflow. Captains approve/reject requests (M6).';

-- comments — threaded comments on events, submissions, disputes (M14)
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  -- Polymorphic: one of these will be set
  event_id uuid references public.events (id) on delete cascade,
  submission_id uuid references public.submissions (id) on delete cascade,
  dispute_id uuid references public.disputes (id) on delete cascade,
  -- Comment data
  author_id uuid not null references public.users (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- At least one target must be set
  constraint comments_has_target check (
    (event_id is not null)::int +
    (submission_id is not null)::int +
    (dispute_id is not null)::int = 1
  )
);

create index idx_comments_event on public.comments (event_id, created_at) where event_id is not null;
create index idx_comments_submission on public.comments (submission_id, created_at) where submission_id is not null;
create index idx_comments_dispute on public.comments (dispute_id, created_at) where dispute_id is not null;
create index idx_comments_parent on public.comments (parent_id) where parent_id is not null;

comment on table public.comments is
  'Threaded comments on events, submissions, or disputes. Polymorphic via CHECK constraint (M14).';

-- RLS for new tables
alter table public.evaluation_criteria enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.comments enable row level security;

-- evaluation_criteria: readable by event members, writable by organizers
create policy "Event members can read criteria"
  on public.evaluation_criteria for select
  using (
    exists (
      select 1 from public.event_members em
      where em.event_id = evaluation_criteria.event_id
        and em.user_id = (select auth.uid())
    )
  );

create policy "Organizers can manage criteria"
  on public.evaluation_criteria for all
  using (
    exists (
      select 1 from public.event_members em
      where em.event_id = evaluation_criteria.event_id
        and em.user_id = (select auth.uid())
        and em.role = 'Organizer'
    )
  );

-- team_join_requests: users can create their own, captains can manage
create policy "Users can create join requests"
  on public.team_join_requests for insert
  with check (user_id = (select auth.uid()));

create policy "Users can view own requests"
  on public.team_join_requests for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_join_requests.team_id
        and t.captain_id = (select auth.uid())
    )
  );

create policy "Captains can update requests"
  on public.team_join_requests for update
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_join_requests.team_id
        and t.captain_id = (select auth.uid())
    )
  );

-- comments: event members can read and create
create policy "Event members can read comments"
  on public.comments for select
  using (
    (event_id is not null and exists (
      select 1 from public.event_members em
      where em.event_id = comments.event_id and em.user_id = (select auth.uid())
    ))
    or (submission_id is not null and exists (
      select 1 from public.submissions s
      join public.event_members em on em.event_id = s.event_id
      where s.id = comments.submission_id and em.user_id = (select auth.uid())
    ))
    or (dispute_id is not null and exists (
      select 1 from public.disputes d
      join public.event_members em on em.event_id = d.event_id
      where d.id = comments.dispute_id and em.user_id = (select auth.uid())
    ))
  );

create policy "Authenticated users can create comments"
  on public.comments for insert
  with check (author_id = (select auth.uid()));
